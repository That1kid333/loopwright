// Loopwright "arrange": the AI producer behind the studio's prompt box.
// A signed-in user sends the prompt the studio built (sound names, lengths, the current
// arrangement and their words; never audio). We check limits and credits, ask Claude,
// charge what the run really cost (AI cost x 2.5, in 1-cent credits) and return the JSON plan.
// The Anthropic key lives only in the ANTHROPIC_API_KEY secret.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Per-mode model, effort, output room and the most a single run may cost.
const MODES: Record<string, { model: string; effort: string; maxTokens: number; maxCredits: number }> = {
  quick: { model: "claude-haiku-5-5", effort: "low", maxTokens: 8000, maxCredits: 2 },
  standard: { model: "claude-sonnet-5-5", effort: "low", maxTokens: 8000, maxCredits: 48 },
  pro: { model: "claude-sonnet-5-5", effort: "medium", maxTokens: 12000, maxCredits: 93 },
  studio: { model: "claude-opus-5-5", effort: "medium", maxTokens: 16000, maxCredits: 183 },
};
// USD per million tokens: [input, output, cache read]
const PRICE: Record<string, [number, number, number]> = {
  "claude-haiku-5-5": [0.1, 0.5, 0.01],
  "claude-sonnet-5-5": [2, 10, 0.1],
  "claude-opus-5-5": [4, 20, 0.2],
};
const MARKUP = 2.5;
const MAX_PROMPT_CHARS = 40000;

const SYSTEM =
  "You are the AI producer inside Loopwright, a music app where people arrange their own sounds. " +
  "You only place and process sounds from the library you are given; you never create audio or imitate a voice. " +
  "Follow the user's message exactly and answer with the JSON object it asks for, with no prose and no code fence.";

function parsePlan(text: string) {
  let t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a > 0 || (b >= 0 && b < t.length - 1)) t = t.slice(a, b + 1);
  return JSON.parse(t);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "bad_request", message: "Use POST." }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: who } = token ? await admin.auth.getUser(token) : { data: { user: null } };
  const user = who?.user;
  if (!user) return json({ error: "sign_in", message: "Sign in to use the AI producer." }, 401);

  let body: { prompt?: string; mode?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_request", message: "Send JSON." }, 400); }
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  if (!prompt.trim()) return json({ error: "bad_request", message: "The prompt is empty." }, 400);
  if (prompt.length > MAX_PROMPT_CHARS) return json({ error: "too_long", message: "That song is too big to send in one go." }, 413);
  const modeName = body.mode && MODES[body.mode] ? body.mode : "standard";
  const mode = MODES[modeName];

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ error: "ai_not_connected", message: "The AI isn't connected yet." }, 503);

  const { data: begun, error: beginErr } = await admin.rpc("ai_begin_run", {
    uid: user.id, run_mode: modeName, max_credits: mode.maxCredits,
  });
  if (beginErr) return json({ error: "server", message: "Couldn't start the run." }, 500);
  if (begun?.error) {
    const msg: Record<string, string> = {
      rate_limited: "Too many prompts at once. Wait a moment and try again.",
      daily_limit: "You've hit today's limit of AI prompts.",
      no_credits: "You're out of credits for this mode.",
    };
    return json({ error: begun.error, message: msg[begun.error] || "Can't run right now.", balance: begun.balance }, begun.error === "no_credits" ? 402 : 429);
  }
  const runId: string = begun.run_id;

  const finish = async (ok: boolean, usage?: Anthropic.Usage) => {
    const p = PRICE[mode.model];
    const cached = usage?.cache_read_input_tokens ?? 0;
    const tin = (usage?.input_tokens ?? 0) + (usage?.cache_creation_input_tokens ?? 0);
    const tout = usage?.output_tokens ?? 0;
    const usd = (tin * p[0] + tout * p[1] + cached * p[2]) / 1e6;
    const credits = ok ? Math.max(1, Math.ceil(usd * 100 * MARKUP)) : 0;
    const { data: balance } = await admin.rpc("ai_finish_run", {
      rid: runId, ok, model_list: [mode.model], tin, tcached: cached, tout, usd: Number(usd.toFixed(6)), charge: credits,
    });
    return { credits, balance };
  };

  try {
    const client = new Anthropic({ apiKey: key });
    const res = await client.messages.create({
      model: mode.model,
      max_tokens: mode.maxTokens,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
      output_config: { effort: mode.effort },
    } as Anthropic.MessageCreateParamsNonStreaming);

    if (res.stop_reason === "refusal") {
      await finish(false, res.usage);
      return json({ error: "refused", message: "Claude wouldn't arrange that one. Try wording it differently." }, 422);
    }
    const text = res.content.filter((b) => b.type === "text").map((b) => (b as Anthropic.TextBlock).text).join("");
    let plan;
    try { plan = parsePlan(text); } catch {
      await finish(false, res.usage);
      return json({ error: "invalid_json", message: "Claude's answer wasn't usable. Nothing was charged." }, 502);
    }
    const { credits, balance } = await finish(true, res.usage);
    return json({ plan, model: mode.model, credits_charged: credits, balance });
  } catch (e) {
    await finish(false);
    const status = (e as { status?: number })?.status;
    if (status === 401 || status === 403) return json({ error: "ai_not_connected", message: "The AI key isn't working." }, 503);
    if (status === 429 || status === 529) return json({ error: "busy", message: "Claude is busy for a moment. Try again." }, 503);
    return json({ error: "server", message: "Claude couldn't answer. Nothing was charged." }, 502);
  }
});
