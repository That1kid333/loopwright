// Loopwright "make-sound": a signed-in user describes a sound in plain words ("warm dusty kick")
// and Claude answers with sound recipes (synth layers + effects, as JSON). The app renders the
// recipe on the user's own machine with site/assets/sound-maker.js, so no audio is generated
// or stored here, nothing is sampled from anyone, and the sound belongs to the user.
// Same credits and limits as "arrange": AI cost x 2.5, in 1-cent credits, failed runs free.
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

// "quick" is plenty for most one-shots; "standard" designs richer layered sounds.
const MODES: Record<string, { model: string; effort: string; maxTokens: number; maxCredits: number }> = {
  quick: { model: "claude-haiku-5-5", effort: "low", maxTokens: 6000, maxCredits: 2 },
  standard: { model: "claude-sonnet-5-5", effort: "low", maxTokens: 8000, maxCredits: 30 },
};
const PRICE: Record<string, [number, number, number]> = { // USD per million: input, output, cache read
  "claude-haiku-5-5": [0.1, 0.5, 0.01],
  "claude-sonnet-5-5": [2, 10, 0.1],
};
const MARKUP = 2.5;
const MAX_DESC = 400;

// Kept in step with the recipe format documented at the top of site/assets/sound-maker.js.
const SYSTEM = `You are the sound designer inside Loopwright, a music app. A user describes a short sound in plain words and you design it as a synthesis recipe. The app renders your recipe with Web Audio (oscillators, noise, FM, plucked strings, filters, effects). You never use or imitate recordings, voices, or another product's signature sound; everything is built from synthesis, so the user owns the result.

Answer with one JSON object and nothing else (no prose, no code fence): {"sounds":[recipe, ...]} with exactly the number of recipes asked for. Make each recipe a clearly different take on the description (for example clean vs gritty, short vs long) and give each a short name in Title Case.

Recipe:
{"name": string, "kind": "oneshot" (drums, hits, FX, textures) or "note" (anything played on a keyboard),
 "root": MIDI note the "note" kind is designed at (e.g. 36 bass, 48-60 keys/pads, 72 bells),
 "length": seconds (0.05-12; leave room for reverb/delay tails), "tags": [up to 5 short words],
 "layers": [1-8 layers], "fx": [0-10 effects in order], "out": {"level": -1, "fade": 0.02}}
Layer:
{"source": one of
   {"type":"osc","wave":"sine|triangle|square|sawtooth|pulse","width":0.05-0.95 (pulse only),"unison":1-7,"spread":cents 0-100}
   {"type":"noise","color":"white|pink|brown"}
   {"type":"fm","wave":"sine","ratio":0.125-16,"index":0-20,"indexEnd":0-20,"indexTime":seconds}  (index = brightness; index -> indexEnd over indexTime)
   {"type":"pluck","damping":0-1,"brightness":0-1}  (Karplus-Strong string)
 pitch: "note": MIDI (oneshot) or "freq": Hz (oneshot), or "semi": semitones from root (kind "note"),
 "pitch": {"from": semitones, "to": semitones, "time": s, "curve": "exp|lin"}  (glide; exp = fast then settles),
 "filter": {"type":"lowpass|highpass|bandpass|notch|peaking|lowshelf|highshelf","freq":Hz,"q":0.1-30,"gain":dB,
            "env":{"from":Hz,"to":Hz,"time":s,"curve":"exp|lin"},"lfo":{"rate":Hz,"depth":Hz}},
 "amp": {"a": attack s, "h": hold s, "d": decay s (time to fade to SILENCE, not half volume), "s": sustain 0-1, "r": release s},
 "vibrato": {"rate":Hz,"depth":cents}, "tremolo": {"rate":Hz,"depth":0-1},
 "gain": 0-2, "pan": -1..1, "delay": s (when the layer starts)}
Effects (each {"type": ...}):
 drive {amount 0-1} | eq {low, mid, midFreq, high in dB} | filter {mode, freq, q} | compress {amount 0-1}
 | chorus {depth 0-1, rate Hz, mix 0-1} | delay {time s, feedback 0-0.9, mix 0-1} | reverb {size 0-1, decay s, mix 0-1}
 | width {amount 0-1} | crush {bits 2-16, rate 0.05-1 = sample-rate fraction} | vinyl {crackle 0-1, hiss 0-1}
 crush and vinyl always run last. The result is trimmed to start on its first sound and peak-normalised.

Craft notes (starting points, adapt freely):
- Kick: sine body around MIDI 28-36 with pitch {"from":20-30,"to":0,"time":0.05-0.12,"curve":"exp"}, d 0.3-0.8; a short triangle or noise click layer (d 0.01-0.03); drive/compress for punch. 808 kick/bass: longer d (1-2.5), "note" kind for tuned 808s.
- Snare/clap: triangle tone MIDI 50-58 with a small pitch drop (d ~0.1) + highpassed white noise (d 0.15-0.3); claps = bandpassed noise layers delayed 0, 0.01, 0.02 s.
- Hi-hats/cymbals: six square oscillators at freq 80,120,166,217,272,328 Hz through a bandpass ~10 kHz plus highpassed white noise; closed d 0.04-0.1, open d 0.3-0.6, cymbal 1-3 s.
- Toms/percussion: sine with pitch drop; congas higher with short d; cowbell = two squares 540/800 Hz through a bandpass.
- Bass: saw or square with lowpass + filter env; sub = sine one octave down; reese = detuned unison saws.
- Pads: unison saws (4-7, spread 15-35) with slow attack (0.5-2 s), lowpass with slow lfo, chorus + big reverb. Bells: fm ratio 3.5 or 1.4, index falling. Keys/EP: fm ratio 1 with low index, or triangle + sine.
- Plucks/guitar: pluck source, or saw with fast filter env. Strings-like: slow attack unison saws + vibrato.
- FX: risers = noise with bandpass env rising + upward pitch glide; downlifters the reverse; impacts = low sine drop + brown noise + long reverb; lasers = square/saw with fast downward lin glide; game sounds = pulse waves + crush.
- Lo-fi/dusty: crush (bits 10-12, rate 0.4-0.6), eq high -4 to -8 dB, vinyl. Warm: drive 0.2-0.4 + lowpass. Bright/airy: high shelf up, noise layer through a high bandpass. Big/wide: width + reverb.
- Keep it musical and clean: avoid harsh resonance (q > 12) unless asked, and keep total layer gain sensible.`;

function parseSounds(text: string) {
  let t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a > 0 || (b >= 0 && b < t.length - 1)) t = t.slice(a, b + 1);
  const o = JSON.parse(t);
  const list = Array.isArray(o?.sounds) ? o.sounds : Array.isArray(o) ? o : [o];
  return list.filter((r: unknown) => r && typeof r === "object" && Array.isArray((r as { layers?: unknown }).layers));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method === "GET") return json({ ok: true, ai: Deno.env.get("ANTHROPIC_API_KEY") ? "connected" : "missing" });
  if (req.method !== "POST") return json({ error: "bad_request", message: "Use POST." }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: who } = token ? await admin.auth.getUser(token) : { data: { user: null } };
  const user = who?.user;
  if (!user) return json({ error: "sign_in", message: "Sign in to make sounds." }, 401);

  let body: { description?: string; count?: number; mode?: string; kind?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_request", message: "Send JSON." }, 400); }
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!description) return json({ error: "bad_request", message: "Describe the sound first." }, 400);
  if (description.length > MAX_DESC) return json({ error: "too_long", message: `Keep the description under ${MAX_DESC} characters.` }, 413);
  const count = Math.min(3, Math.max(1, Math.round(Number(body.count) || 2)));
  const kindHint = body.kind === "note" ? " It should be playable on a keyboard (kind \"note\")."
    : body.kind === "oneshot" ? " It should be a one-shot (kind \"oneshot\")." : "";
  const modeName = body.mode && MODES[body.mode] ? body.mode : "standard";
  const mode = MODES[modeName];

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ error: "ai_not_connected", message: "The AI isn't connected yet." }, 503);

  // Same limits and credit hold as the AI producer. Runs are recorded under the existing mode names.
  const { data: begun, error: beginErr } = await admin.rpc("ai_begin_run", {
    uid: user.id, run_mode: modeName, max_credits: mode.maxCredits,
  });
  if (beginErr) return json({ error: "server", message: "Couldn't start the run." }, 500);
  if (begun?.error) {
    const msg: Record<string, string> = {
      rate_limited: "Too many requests at once. Wait a moment and try again.",
      daily_limit: "You've hit today's limit of AI requests.",
      no_credits: "You're out of credits for this.",
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
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: `Design ${count} recipe${count > 1 ? "s" : ""} for this sound: ${JSON.stringify(description)}.${kindHint}` }],
      output_config: { effort: mode.effort },
    } as Anthropic.MessageCreateParamsNonStreaming);

    if (res.stop_reason === "refusal") {
      await finish(false, res.usage);
      return json({ error: "refused", message: "Claude wouldn't make that one. Try describing it differently." }, 422);
    }
    const text = res.content.filter((b) => b.type === "text").map((b) => (b as Anthropic.TextBlock).text).join("");
    let sounds;
    try { sounds = parseSounds(text); } catch { sounds = []; }
    if (!sounds.length) {
      await finish(false, res.usage);
      return json({ error: "invalid_json", message: "Claude's answer wasn't usable. Nothing was charged." }, 502);
    }
    const { credits, balance } = await finish(true, res.usage);
    return json({ sounds: sounds.slice(0, count), model: mode.model, credits_charged: credits, balance });
  } catch (e) {
    await finish(false);
    const status = (e as { status?: number })?.status;
    const apiErr = (e as { error?: { error?: { type?: string; message?: string } } })?.error?.error;
    console.error("anthropic_error", status ?? "none", apiErr?.type ?? (e as Error)?.name, (apiErr?.message ?? (e as Error)?.message ?? "").slice(0, 300));
    if (/credit balance/i.test(apiErr?.message ?? "")) return json({ error: "ai_billing", message: "The Anthropic account behind the AI is out of credit." }, 503);
    if (status === 401 || status === 403) return json({ error: "ai_not_connected", message: "The AI key isn't working." }, 503);
    if (status === 429 || status === 529) return json({ error: "busy", message: "Claude is busy for a moment. Try again." }, 503);
    return json({ error: "server", message: "Claude couldn't answer. Nothing was charged." }, 502);
  }
});
