// library-import: fills Loopwright's free preset library.
//
// POST {action:"seed", url}  loads catalog.json (packs, items, file list) into the tables.
// POST {} or {action:"run"}  copies pending files from each pack's GitHub repo (pinned commit)
//                            into the public "library" bucket, in the background.
// Every call needs the x-import-token header that matches library_private.settings
// (checked by library_check_token). pg_cron sends it; nothing else knows it.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

type Pack = { id: string; repo: string; sha: string };

function rawUrl(p: Pack, path: string) {
  return `https://raw.githubusercontent.com/${p.repo}/${p.sha}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

async function chunked<T>(rows: T[], size: number, fn: (part: T[]) => Promise<void>) {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
}

async function seed(url: string) {
  if (!/^https:\/\/raw\.githubusercontent\.com\/That1kid333\/loopwright\//.test(url)) throw new Error("bad url");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`catalog ${res.status}`);
  const cat = await res.json();
  const packs = cat.packs.map((p: any) => ({
    id: p.id, name: p.name, author: p.author, license: p.license, source_url: p.source, page_url: p.page,
    repo: p.repo, repo_sha: p.sha, about: p.about, file_count: p.file_count, item_count: p.item_count,
  }));
  let r = await sb.from("library_packs").upsert(packs);
  if (r.error) throw r.error;
  const items = cat.items.map((it: any) => ({
    id: it.id, pack_id: it.pack, name: it.name, kind: it.kind, category: it.category, subcategory: it.sub,
    tags: it.tags, preview_path: it.preview, key_low: it.range?.[0] ?? null, key_high: it.range?.[1] ?? null,
    zone_count: (it.zones ?? it.hits).length, zones: it.zones ?? null, hits: it.hits ?? null,
  }));
  await chunked(items, 25, async (part) => {
    const q = await sb.from("library_items").upsert(part);
    if (q.error) throw q.error;
  });
  const files: any[] = [];
  for (const [pack, list] of Object.entries(cat.files as Record<string, string[][]>)) {
    for (const [path, repo_path, content_type] of list) files.push({ path, pack_id: pack, repo_path, content_type });
  }
  await chunked(files, 1000, async (part) => {
    const q = await sb.from("library_files").upsert(part, { onConflict: "path", ignoreDuplicates: true });
    if (q.error) throw q.error;
  });
  return { packs: packs.length, items: items.length, files: files.length };
}

async function copyOne(f: any, packs: Map<string, Pack>, token: string) {
  try {
    const p = packs.get(f.pack_id)!;
    const res = await fetch(rawUrl(p, f.repo_path));
    if (!res.ok) throw new Error(`github ${res.status}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    const up = await sb.storage.from("library").upload(f.path, buf, {
      contentType: f.content_type, upsert: true, cacheControl: "31536000",
    });
    if (up.error) throw up.error;
    await sb.rpc("library_finish", { p: f.path, ok: true, b: buf.byteLength, err: null, t: token });
  } catch (e) {
    await sb.rpc("library_finish", { p: f.path, ok: false, b: null, err: String((e as Error)?.message ?? e).slice(0, 300), t: token });
  }
}

async function run(token: string, seconds: number, parallel: number) {
  const { data: rows, error } = await sb.from("library_packs").select("id, repo, repo_sha");
  if (error) throw error;
  const packs = new Map<string, Pack>(rows!.map((r: any) => [r.id, { id: r.id, repo: r.repo, sha: r.repo_sha }]));
  const stop = Date.now() + seconds * 1000;
  let done = 0;
  while (Date.now() < stop) {
    const { data: batch, error: e } = await sb.rpc("library_claim", { n: parallel, t: token });
    if (e) throw e;
    if (!batch || batch.length === 0) break;
    await Promise.all(batch.map((f: any) => copyOne(f, packs, token)));
    done += batch.length;
  }
  console.log(`library-import copied ${done} files`);
}

Deno.serve(async (req) => {
  const token = req.headers.get("x-import-token") ?? "";
  const { data: ok } = await sb.rpc("library_check_token", { t: token });
  if (!ok) return new Response("not allowed", { status: 401 });
  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === "seed") {
      return Response.json(await seed(body.url));
    }
    const seconds = Math.min(Number(body.seconds ?? 100), 300);
    const parallel = Math.min(Number(body.parallel ?? 8), 16);
    EdgeRuntime.waitUntil(run(token, seconds, parallel));
    return Response.json({ started: true, seconds, parallel }, { status: 202 });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
});
