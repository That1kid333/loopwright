/* Loopwright preset library: browse, search and play the free sounds.
 *
 * Two kinds of sounds share one catalog:
 *  - Recorded packs (CC0) in Supabase: tables library_packs / library_items, audio in the
 *    public "library" bucket. Loaded on demand and kept in the browser's Cache Storage.
 *  - Loopwright Originals: electronic sounds made in code (originals.js), no download.
 *
 * Use:
 *   const lib = LoopwrightLibrary;
 *   const { items } = await lib.search("808 kick", { category: "Drums" });
 *   const player = await lib.load(items[0].id, audioCtx);   // instrument or kit
 *   await player.ready();                                   // optional: preload
 *   player.play(60, 100, audioCtx.currentTime, { duration: 1 });   // instrument: midi note, velocity
 *   player.play(0, 100);                                    // kit: hit index (or hit name), velocity
 *   lib.preview(id, audioCtx);                              // short audition
 */
window.LoopwrightLibrary = (function () {
  const URL = "https://vvllgdrpnieorcpweurz.supabase.co";
  const KEY = "sb_publishable_6iCD4SBhUOXgOoyyIT3qZA__dTbzZZF";
  const PUBLIC = URL + "/storage/v1/object/public/library/";
  const CACHE = "loopwright-library-v1";
  const H = { apikey: KEY, Authorization: "Bearer " + KEY };

  const itemCache = new Map();   // id -> item row (with zones/hits)
  const bufCache = new Map();    // "ctxid|path" -> Promise<AudioBuffer>
  let packsP = null, indexP = null;

  async function rest(path, init) {
    const res = await fetch(URL + "/rest/v1/" + path, { ...init, headers: { ...H, ...(init && init.headers) } });
    if (!res.ok) throw new Error("library " + res.status + " " + (await res.text()).slice(0, 200));
    return res.json();
  }

  function originals() { return (window.LoopwrightOriginals && window.LoopwrightOriginals.items) || []; }

  function fileUrl(path) { return PUBLIC + path.split("/").map(encodeURIComponent).join("/"); }

  /** Every pack with its license and source page. */
  function packs() {
    if (!packsP) packsP = rest("library_packs?select=id,name,author,license,source_url,page_url,about,file_count,item_count&order=name")
      .then((rows) => rows.concat(window.LoopwrightOriginals ? [window.LoopwrightOriginals.pack] : []));
    return packsP;
  }

  /** Light list of every item (no zones), for category counts and offline filtering. */
  function index() {
    if (!indexP) indexP = rest("library_items?select=id,pack_id,name,kind,category,subcategory,tags,preview_path,key_low,key_high,zone_count&order=category,name&limit=5000")
      .then((rows) => originals().map(strip).concat(rows));
    return indexP;
  }

  function strip(o) { const { make, ...rest } = o; return rest; }

  /** Categories with counts, e.g. [{category:"Drums", count:40, subcategories:{Kick:6,...}}]. */
  async function categories() {
    const rows = await index(), map = new Map();
    for (const r of rows) {
      const c = map.get(r.category) || { category: r.category, count: 0, subcategories: {} };
      c.count++; if (r.subcategory) c.subcategories[r.subcategory] = (c.subcategories[r.subcategory] || 0) + 1;
      map.set(r.category, c);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }

  function matchLocal(o, q, cat) {
    if (cat && o.category !== cat) return false;
    if (!q) return true;
    const hay = (o.name + " " + o.category + " " + (o.subcategory || "") + " " + o.tags.join(" ")).toLowerCase();
    return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
  }

  /** Search by words (name, instrument, genre tags). Options: category, limit, offset. */
  async function search(q, opts) {
    opts = opts || {};
    const lim = opts.limit || 60, off = opts.offset || 0;
    const local = originals().filter((o) => matchLocal(o, (q || "").trim(), opts.category)).map(strip);
    let remote = [];
    try {
      remote = await rest("rpc/library_search", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: q || "", cat: opts.category || null, lim, off }),
      });
    } catch (e) { if (!local.length) throw e; }
    const items = off === 0 ? local.concat(remote) : remote;
    return { items, more: remote.length === lim };
  }

  /** Full item, including zones (instrument) or hits (kit). */
  async function getItem(id) {
    if (itemCache.has(id)) return itemCache.get(id);
    const o = originals().find((x) => x.id === id);
    if (o) { itemCache.set(id, o); return o; }
    const rows = await rest("library_items?id=eq." + encodeURIComponent(id) + "&select=*");
    if (!rows.length) throw new Error("no such sound: " + id);
    itemCache.set(id, rows[0]);
    return rows[0];
  }

  const ctxIds = new WeakMap(); let ctxN = 0;
  function ctxKey(ctx) { if (!ctxIds.has(ctx)) ctxIds.set(ctx, ++ctxN); return ctxIds.get(ctx); }

  async function fetchBytes(path) {
    const url = fileUrl(path);
    let cache = null;
    try { cache = await caches.open(CACHE); const hit = await cache.match(url); if (hit) return hit.arrayBuffer(); } catch (e) { cache = null; }
    const res = await fetch(url);
    if (!res.ok) throw new Error("sound file " + res.status + ": " + path);
    if (cache) { try { await cache.put(url, res.clone()); } catch (e) { /* storage full or private mode */ } }
    return res.arrayBuffer();
  }

  /** Decoded AudioBuffer for one library file. */
  function buffer(path, ctx) {
    const k = ctxKey(ctx) + "|" + path;
    if (!bufCache.has(k)) {
      const p = fetchBytes(path).then((b) => ctx.decodeAudioData(b));
      p.catch(() => bufCache.delete(k));
      bufCache.set(k, p);
    }
    return bufCache.get(k);
  }

  const dbToGain = (db) => Math.pow(10, (db || 0) / 20);
  const velGain = (v) => Math.pow(Math.max(1, Math.min(127, v)) / 127, 1.6) * 0.9 + 0.1;

  function startBuffer(ctx, buf, when, rate, gain, dest, duration, release) {
    const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.value = gain;
    src.connect(g).connect(dest || ctx.destination);
    src.start(when);
    if (duration) {
      const end = when + duration, rel = release == null ? 0.25 : release;
      g.gain.setValueAtTime(gain, end); g.gain.linearRampToValueAtTime(0.0001, end + rel); src.stop(end + rel + 0.02);
    }
    return { source: src, gain: g, stop(t) { const at = t || ctx.currentTime; g.gain.cancelScheduledValues(at); g.gain.setValueAtTime(g.gain.value, at); g.gain.linearRampToValueAtTime(0.0001, at + 0.15); src.stop(at + 0.2); } };
  }

  function instrumentPlayer(item, ctx) {
    // zone: [file, lokey, hikey, root, lovel, hivel, rr, tune_cents, volume_db]
    const zones = item.zones, rrNext = new Map();
    function pick(note, vel) {
      let cands = zones.filter((z) => note >= z[1] && note <= z[2] && vel >= z[4] && vel <= z[5]);
      if (!cands.length) cands = zones.filter((z) => note >= z[1] && note <= z[2]);
      if (!cands.length) { // outside the sampled range: nearest root
        const best = Math.min(...zones.map((z) => Math.abs(z[3] - note)));
        cands = zones.filter((z) => Math.abs(z[3] - note) === best);
      }
      const rrs = [...new Set(cands.map((z) => z[6]))].sort((a, b) => a - b);
      if (rrs.length > 1) {
        const key = cands[0][1] + ":" + cands[0][4], i = (rrNext.get(key) || 0) % rrs.length; rrNext.set(key, i + 1);
        cands = cands.filter((z) => z[6] === rrs[i]);
      }
      return cands[0];
    }
    return {
      item, kind: "instrument", range: [item.key_low, item.key_high],
      /** Preload: all zones for these notes (default: the zones a mid velocity uses). */
      ready(notes, vel) {
        const v = vel || 100;
        const zs = notes ? notes.map((n) => pick(n, v)) : zones.filter((z) => v >= z[4] && v <= z[5]);
        return Promise.all([...new Set(zs.map((z) => z[0]))].map((f) => buffer(f, ctx)));
      },
      async play(note, vel, when, opt) {
        opt = opt || {}; vel = vel == null ? 100 : vel;
        const z = pick(note, vel), buf = await buffer(z[0], ctx);
        const rate = Math.pow(2, ((note - z[3]) * 100 + (z[7] || 0)) / 1200);
        const at = Math.max(when || 0, ctx.currentTime);
        return startBuffer(ctx, buf, at, rate, dbToGain(z[8]) * velGain(vel) * (opt.gain == null ? 1 : opt.gain), opt.destination, opt.duration, opt.release);
      },
    };
  }

  function kitPlayer(item, ctx) {
    // hit: {name, z: [[file or [mic files...], lovel, hivel, rr, volume_db], ...]}
    const hits = item.hits, rrNext = new Map();
    const files = (z) => (Array.isArray(z[0]) ? z[0] : [z[0]]);
    function find(h) { return typeof h === "number" ? hits[h] : hits.find((x) => x.name.toLowerCase() === String(h).toLowerCase()) || hits[0]; }
    function pick(hit, vel) {
      let c = hit.z.filter((z) => vel >= z[1] && vel <= z[2]); if (!c.length) c = hit.z;
      const rrs = [...new Set(c.map((z) => z[3]))].sort((a, b) => a - b);
      if (rrs.length > 1) { const k = hit.name + c[0][1], i = (rrNext.get(k) || 0) % rrs.length; rrNext.set(k, i + 1); c = c.filter((z) => z[3] === rrs[i]); }
      return c[0];
    }
    return {
      item, kind: "kit", hits: hits.map((h, i) => ({ index: i, name: h.name })),
      ready(which, vel) {
        const v = vel || 100, list = which ? which.map(find) : hits;
        return Promise.all(list.flatMap((h) => files(pick(h, v)).map((f) => buffer(f, ctx))));
      },
      async play(h, vel, when, opt) {
        opt = opt || {}; vel = vel == null ? 100 : vel;
        const hit = find(h), z = pick(hit, vel), fs = files(z);
        const bufs = await Promise.all(fs.map((f) => buffer(f, ctx)));
        const at = Math.max(when || 0, ctx.currentTime), g = dbToGain(z[4]) * velGain(vel) * (opt.gain == null ? 1 : opt.gain) / Math.sqrt(fs.length);
        const rate = Math.pow(2, (opt.tune || 0) / 1200);
        const voices = bufs.map((b) => startBuffer(ctx, b, at, rate, g, opt.destination, opt.duration, opt.release));
        return { stop(t) { voices.forEach((v) => v.stop(t)); } };
      },
    };
  }

  /** A player for any item id (recorded instrument, recorded kit, or an Original). */
  async function load(id, ctx) {
    const item = await getItem(id);
    if (item.make) return window.LoopwrightOriginals.player(item, ctx);
    return item.kind === "kit" ? kitPlayer(item, ctx) : instrumentPlayer(item, ctx);
  }

  /** Short audition of an item. */
  async function preview(id, ctx, dest) {
    const p = await load(id, ctx);
    if (p.kind === "kit") return p.play(0, 110, 0, { destination: dest });
    const mid = p.range && p.range[0] != null ? Math.round((Math.max(p.range[0], 36) + Math.min(p.range[1], 84)) / 2) : 60;
    return p.play(mid, 100, 0, { duration: 1.2, destination: dest });
  }

  /** A whole item as one AudioBuffer (one note or hit), e.g. to add it to a song as a plain sample. */
  async function render(id, opts) {
    opts = opts || {};
    const sr = opts.sampleRate || 44100, len = opts.seconds || 2;
    const off = new OfflineAudioContext(2, Math.ceil(sr * len), sr);
    const p = await load(id, off);
    await p.ready(p.kind === "kit" ? [opts.hit || 0] : [opts.note || 60]);
    await p.play(p.kind === "kit" ? (opts.hit || 0) : (opts.note || 60), opts.velocity || 100, 0, p.kind === "kit" ? {} : { duration: len - 0.3 });
    return off.startRendering();
  }

  return { search, categories, packs, index, getItem, load, preview, render, buffer, fileUrl };
})();
