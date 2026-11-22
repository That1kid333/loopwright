/* Loopwright Sound Maker: turn a sound recipe into audio.
 *
 * The AI (or a person) describes a sound as a small JSON recipe: layers of oscillators, noise,
 * FM or plucked strings, each with its own pitch, filter and volume shapes, then an effects chain.
 * This file checks the recipe, renders it offline with the Web Audio API and hands back an
 * AudioBuffer (and a WAV file on request). Everything is synthesis, so the result has no
 * samples in it and nothing to license: it belongs to the person who made it.
 *
 * Works in the browser and in Node (pass an OfflineAudioContext class, e.g. node-web-audio-api).
 *
 * Recipe shape (all fields optional except layers; numbers are clamped to safe ranges):
 * {
 *   name: "Dusty kick", kind: "oneshot" | "note", root: 48 (MIDI, for "note"), length: 1.2 (s),
 *   layers: [{
 *     source: { type: "osc", wave: "sine|triangle|square|sawtooth|pulse", width: 0.25, unison: 1-7, spread: cents }
 *           | { type: "noise", color: "white|pink|brown" }
 *           | { type: "fm", wave: "sine", ratio: 2, index: 3, indexEnd: 0.5, indexTime: 0.3 }
 *           | { type: "pluck", damping: 0.5, brightness: 0.7 },
 *     note: 36 (MIDI) or freq: 55 (Hz); for kind "note" use semi: offset from root,
 *     pitch: { from: 24, to: 0, time: 0.05, curve: "exp|lin" }   // semitones, glides from -> to
 *     filter: { type: "lowpass|highpass|bandpass|notch|peaking", freq: 800, q: 1, gain: 0,
 *               env: { from: 6000, to: 300, time: 0.2 }, lfo: { rate: 2, depth: 400 } },
 *     amp: { a: 0.002, h: 0, d: 0.4, s: 0, r: 0.2 },   // attack, hold, decay, sustain level, release
 *     vibrato: { rate: 5, depth: 10 }, tremolo: { rate: 6, depth: 0.5 },
 *     gain: 0.8, pan: 0, delay: 0 (s, when the layer starts)
 *   }],
 *   fx: [ { type: "drive", amount: 0.3 }, { type: "crush", bits: 10, rate: 0.5 },
 *         { type: "eq", low: 3, mid: -2, midFreq: 800, high: -4 }, { type: "filter", type2..., see below },
 *         { type: "compress", amount: 0.5 }, { type: "chorus", depth: 0.5, rate: 0.8, mix: 0.4 },
 *         { type: "delay", time: 0.25, feedback: 0.3, mix: 0.25 }, { type: "reverb", size: 0.6, decay: 2, mix: 0.3 },
 *         { type: "vinyl", crackle: 0.3, hiss: 0.1 }, { type: "width", amount: 0.5 } ],
 *   out: { level: -1 (dBFS peak), fade: 0.05 (s) }
 * }
 * Timing: amp.d is the time to fade to silence (not to half volume), as in Loopwright Originals.
 * "crush" and "vinyl" always run after the other effects, in the order listed. The result starts on its
 * first audible sample and its silent end is trimmed, so a one-shot hits exactly on the beat.
 */
(function (root) {
  "use strict";
  const SR = 44100;
  const MAX_LEN = 12, MAX_LAYERS = 8, MAX_FX = 10;
  const WAVES = ["sine", "triangle", "square", "sawtooth", "pulse"];
  const FILTERS = ["lowpass", "highpass", "bandpass", "notch", "peaking", "lowshelf", "highshelf"];
  const FX = ["drive", "crush", "eq", "filter", "compress", "chorus", "delay", "reverb", "vinyl", "width"];

  // ---------- recipe checking ----------
  const num = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
  const pick = (v, list, d) => (list.includes(v) ? v : d);
  const str = (v, d, n) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n || 60) : d);

  function cleanEnv(e, lo, hi) {
    if (!e || typeof e !== "object") return null;
    return { from: num(e.from, lo, hi, 0), to: num(e.to, lo, hi, 0), time: num(e.time, 0.001, MAX_LEN, 0.1), curve: pick(e.curve, ["exp", "lin"], "exp") };
  }
  function cleanLayer(L, kind, warn, i) {
    if (!L || typeof L !== "object") { warn.push(`layer ${i + 1} ignored`); return null; }
    const S = L.source || {};
    const type = pick(S.type, ["osc", "noise", "fm", "pluck"], null);
    if (!type) { warn.push(`layer ${i + 1}: unknown source, used a sine`); }
    const src = { type: type || "osc" };
    if (src.type === "osc") Object.assign(src, { wave: pick(S.wave, WAVES, "sine"), width: num(S.width, 0.05, 0.95, 0.25), unison: Math.round(num(S.unison, 1, 7, 1)), spread: num(S.spread, 0, 100, 0) });
    if (src.type === "noise") src.color = pick(S.color, ["white", "pink", "brown"], "white");
    if (src.type === "fm") Object.assign(src, { wave: pick(S.wave, ["sine", "triangle", "square", "sawtooth"], "sine"), ratio: num(S.ratio, 0.125, 16, 2), index: num(S.index, 0, 20, 2), indexEnd: num(S.indexEnd, 0, 20, num(S.index, 0, 20, 2)), indexTime: num(S.indexTime, 0.001, MAX_LEN, 0.3) });
    if (src.type === "pluck") Object.assign(src, { damping: num(S.damping, 0, 1, 0.5), brightness: num(S.brightness, 0, 1, 0.7) });
    const out = { source: src };
    if (kind === "note") out.semi = num(L.semi, -48, 48, 0);
    else if (L.freq != null) out.freq = num(L.freq, 8, 18000, 220);
    else out.note = num(L.note, 0, 127, 60);
    out.pitch = cleanEnv(L.pitch, -48, 48);
    if (L.filter && typeof L.filter === "object") {
      const F = L.filter;
      out.filter = { type: pick(F.type, FILTERS, "lowpass"), freq: num(F.freq, 20, 20000, 2000), q: num(F.q, 0.1, 30, 0.7), gain: num(F.gain, -24, 24, 0), env: cleanEnv(F.env, 20, 20000) };
      if (F.lfo) out.filter.lfo = { rate: num(F.lfo.rate, 0.05, 30, 2), depth: num(F.lfo.depth, 0, 8000, 300) };
    }
    const A = L.amp || {};
    out.amp = { a: num(A.a, 0.0005, MAX_LEN, 0.003), h: num(A.h, 0, MAX_LEN, 0), d: num(A.d, 0.005, MAX_LEN, 0.4), s: num(A.s, 0, 1, 0), r: num(A.r, 0.005, MAX_LEN, 0.15) };
    if (L.vibrato) out.vibrato = { rate: num(L.vibrato.rate, 0.1, 20, 5), depth: num(L.vibrato.depth, 0, 200, 10) };
    if (L.tremolo) out.tremolo = { rate: num(L.tremolo.rate, 0.1, 30, 6), depth: num(L.tremolo.depth, 0, 1, 0.5) };
    out.gain = num(L.gain, 0, 2, 0.7);
    out.pan = num(L.pan, -1, 1, 0);
    out.delay = num(L.delay, 0, MAX_LEN, 0);
    return out;
  }
  function cleanFx(F, warn, i) {
    const type = F && pick(F.type, FX, null);
    if (!type) { warn.push(`effect ${i + 1} ignored`); return null; }
    switch (type) {
      case "drive": return { type, amount: num(F.amount, 0, 1, 0.3) };
      case "crush": return { type, bits: Math.round(num(F.bits, 2, 16, 12)), rate: num(F.rate, 0.05, 1, 1) };
      case "eq": return { type, low: num(F.low, -18, 18, 0), mid: num(F.mid, -18, 18, 0), midFreq: num(F.midFreq, 100, 8000, 1000), high: num(F.high, -18, 18, 0) };
      case "filter": return { type, mode: pick(F.mode, FILTERS, "lowpass"), freq: num(F.freq, 20, 20000, 8000), q: num(F.q, 0.1, 30, 0.7) };
      case "compress": return { type, amount: num(F.amount, 0, 1, 0.5) };
      case "chorus": return { type, depth: num(F.depth, 0, 1, 0.5), rate: num(F.rate, 0.05, 8, 0.8), mix: num(F.mix, 0, 1, 0.4) };
      case "delay": return { type, time: num(F.time, 0.01, 2, 0.25), feedback: num(F.feedback, 0, 0.9, 0.3), mix: num(F.mix, 0, 1, 0.25) };
      case "reverb": return { type, size: num(F.size, 0, 1, 0.5), decay: num(F.decay, 0.1, 10, 1.8), mix: num(F.mix, 0, 1, 0.3) };
      case "vinyl": return { type, crackle: num(F.crackle, 0, 1, 0.3), hiss: num(F.hiss, 0, 1, 0.1) };
      case "width": return { type, amount: num(F.amount, 0, 1, 0.5) };
    }
    return null;
  }
  /** Check a recipe from anywhere (AI, file, user). Returns { recipe, warnings }. Never throws on bad input. */
  function check(input) {
    const warn = [];
    const R = input && typeof input === "object" ? input : {};
    const kind = pick(R.kind, ["oneshot", "note"], "oneshot");
    const layersIn = Array.isArray(R.layers) ? R.layers : [];
    if (layersIn.length > MAX_LAYERS) warn.push(`only the first ${MAX_LAYERS} layers are used`);
    let layers = layersIn.slice(0, MAX_LAYERS).map((L, i) => cleanLayer(L, kind, warn, i)).filter(Boolean);
    if (!layers.length) { warn.push("recipe had no usable layers, used a plain tone"); layers = [cleanLayer({ source: { type: "osc" } }, kind, warn, 0)]; }
    const fxIn = Array.isArray(R.fx) ? R.fx : [];
    const fx = fxIn.slice(0, MAX_FX).map((F, i) => cleanFx(F, warn, i)).filter(Boolean);
    // Default length: long enough for the slowest layer to finish, plus reverb/delay tails.
    const need = Math.max(...layers.map((L) => L.delay + L.amp.a + L.amp.h + L.amp.d + (L.amp.s > 0 ? 0.5 + L.amp.r : 0)));
    const tail = fx.reduce((t, F) => Math.max(t, F.type === "reverb" ? F.decay * F.mix * 1.5 : F.type === "delay" ? F.time * 4 * F.feedback : 0), 0);
    const length = num(R.length, 0.05, MAX_LEN, Math.min(MAX_LEN, need + tail + 0.05));
    const O = R.out || {};
    return {
      recipe: {
        name: str(R.name, "New sound"), kind, root: Math.round(num(R.root, 24, 96, 60)), length,
        tags: Array.isArray(R.tags) ? R.tags.filter((t) => typeof t === "string").slice(0, 8).map((t) => t.slice(0, 24)) : [],
        layers, fx, out: { level: num(O.level, -24, 0, -1), fade: num(O.fade, 0, 2, 0.02) },
      },
      warnings: warn,
    };
  }

  // ---------- rendering helpers ----------
  const mtof = (n) => 440 * Math.pow(2, (n - 69) / 12);
  function noiseBuffer(ctx, color, seconds) {
    const n = Math.max(1, Math.ceil(seconds * ctx.sampleRate)), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (color === "pink") { // Paul Kellet's filter
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      } else if (color === "brown") { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else d[i] = w;
    }
    return b;
  }
  function pulseWave(ctx, w) {
    const n = 64, re = new Float32Array(n), im = new Float32Array(n);
    for (let i = 1; i < n; i++) re[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * w);
    return ctx.createPeriodicWave(re, im);
  }
  function pluckBuffer(ctx, f, seconds, damping, brightness) { // Karplus-Strong, rendered at the note's pitch
    const sr = ctx.sampleRate, n = Math.max(1, Math.ceil(seconds * sr)), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
    const p = Math.max(2, Math.round(sr / f)), line = new Float32Array(p);
    let lp = 0; const k = 0.2 + brightness * 0.75;
    for (let i = 0; i < p; i++) { const w = Math.random() * 2 - 1; lp += k * (w - lp); line[i] = lp; }
    const decay = 0.9995 - damping * 0.012;
    let idx = 0, prev = 0;
    for (let i = 0; i < n; i++) {
      const cur = line[idx]; const next = decay * 0.5 * (cur + prev); prev = cur;
      line[idx] = next; d[i] = cur; idx = (idx + 1) % p;
    }
    return b;
  }
  function shapeCurve(amount) {
    const c = new Float32Array(2048), q = 1 + amount * 30, t = Math.tanh(q);
    for (let i = 0; i < 2048; i++) { const x = i / 1023.5 - 1; c[i] = Math.tanh(q * x) / t; }
    return c;
  }
  function reverbIR(ctx, size, decay) {
    const sr = ctx.sampleRate, len = Math.ceil(Math.min(10, decay) * sr), b = ctx.createBuffer(2, len, sr);
    const pre = Math.floor((0.005 + size * 0.03) * sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch); let lp = 0;
      const damp = 0.35 + (1 - size) * 0.5;
      for (let i = pre; i < len; i++) {
        const t = (i - pre) / sr, w = Math.random() * 2 - 1;
        lp += damp * (w - lp);
        d[i] = lp * Math.pow(10, (-3 * t) / decay); // -60 dB at `decay` seconds
      }
    }
    return b;
  }
  function setEnv(param, env, base, t0, mul) { // pitch or filter envelope
    if (!env) return;
    const a = mul(env.from), b = mul(env.to);
    param.setValueAtTime(a, t0);
    if (env.curve === "lin") param.linearRampToValueAtTime(b, t0 + env.time);
    else param.exponentialRampToValueAtTime(Math.max(1e-4, b), t0 + env.time);
  }

  function buildLayer(ctx, L, R, dest) {
    const t0 = L.delay, A = L.amp, end = R.length;
    const baseNote = R.kind === "note" ? R.root + L.semi : L.note;
    const f0 = L.freq != null && R.kind !== "note" ? L.freq : mtof(baseNote);
    const amp = ctx.createGain(); amp.gain.value = 0;
    let head = amp;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) { pan.pan.value = L.pan; amp.connect(pan).connect(dest); } else amp.connect(dest);
    if (L.tremolo) {
      const trem = ctx.createGain(); trem.gain.value = 1 - L.tremolo.depth / 2;
      const lfo = ctx.createOscillator(); lfo.frequency.value = L.tremolo.rate; const lg = ctx.createGain(); lg.gain.value = L.tremolo.depth / 2;
      lfo.connect(lg).connect(trem.gain); lfo.start(t0); lfo.stop(end);
      trem.connect(head); head = trem;
    }
    if (L.filter) {
      const F = L.filter, bq = ctx.createBiquadFilter();
      bq.type = F.type; bq.frequency.value = F.freq; bq.Q.value = F.q; bq.gain.value = F.gain;
      setEnv(bq.frequency, F.env, F.freq, t0, (v) => v);
      if (F.lfo) { const lfo = ctx.createOscillator(); lfo.frequency.value = F.lfo.rate; const lg = ctx.createGain(); lg.gain.value = F.lfo.depth; lfo.connect(lg).connect(bq.frequency); lfo.start(t0); lfo.stop(end); }
      bq.connect(head); head = bq;
    }
    const pitchParams = []; // detune AudioParams to receive pitch env + vibrato
    const S = L.source;
    if (S.type === "osc" || S.type === "fm") {
      const U = S.type === "osc" ? S.unison : 1;
      for (let u = 0; u < U; u++) {
        const o = ctx.createOscillator();
        if (S.wave === "pulse") o.setPeriodicWave(pulseWave(ctx, S.width)); else o.type = S.wave;
        o.frequency.value = f0;
        const det = U > 1 ? (u / (U - 1) - 0.5) * S.spread : 0;
        o.detune.value = det;
        const g = ctx.createGain(); g.gain.value = 1 / Math.sqrt(U);
        o.connect(g).connect(head); o.start(t0); o.stop(end);
        pitchParams.push([o.detune, det]);
        if (S.type === "fm") {
          const m = ctx.createOscillator(); m.frequency.value = f0 * S.ratio;
          const mg = ctx.createGain();
          mg.gain.setValueAtTime(f0 * S.index, t0);
          mg.gain.exponentialRampToValueAtTime(Math.max(1e-3, f0 * S.indexEnd), t0 + S.indexTime);
          m.connect(mg).connect(o.frequency); m.start(t0); m.stop(end);
          pitchParams.push([m.detune, 0]);
        }
      }
    } else if (S.type === "noise") {
      const s = ctx.createBufferSource(); s.buffer = noiseBuffer(ctx, S.color, Math.max(0.05, end - t0));
      s.connect(head); s.start(t0); s.stop(end);
    } else if (S.type === "pluck") {
      const s = ctx.createBufferSource(); s.buffer = pluckBuffer(ctx, f0, Math.max(0.05, end - t0), S.damping, S.brightness);
      const g = ctx.createGain(); g.gain.value = 1.6;
      s.connect(g).connect(head); s.start(t0); s.stop(end);
    }
    // pitch envelope (semitones -> cents) and vibrato on every pitched source
    pitchParams.forEach(([p, base]) => {
      if (!p) return;
      if (L.pitch) setEnv(p, { ...L.pitch, curve: "lin" }, 0, t0, (v) => base + v * 100);
      if (L.pitch && L.pitch.curve === "exp") { // exponential-feeling glide: fast at first, settles
        p.cancelScheduledValues(t0); p.setValueAtTime(base + L.pitch.from * 100, t0);
        p.setTargetAtTime(base + L.pitch.to * 100, t0, Math.max(0.001, L.pitch.time / 4));
      }
      if (L.vibrato) { const v = ctx.createOscillator(); v.frequency.value = L.vibrato.rate; const vg = ctx.createGain(); vg.gain.value = L.vibrato.depth; v.connect(vg).connect(p); v.start(t0); v.stop(end); }
    });
    // amplitude: attack, hold, decay to sustain, then release so it ends inside the render
    const g = amp.gain, peak = L.gain;
    g.setValueAtTime(0, t0);
    g.linearRampToValueAtTime(peak, t0 + A.a);
    g.setValueAtTime(peak, t0 + A.a + A.h);
    const sus = Math.max(1e-4, peak * A.s);
    g.exponentialRampToValueAtTime(sus, t0 + A.a + A.h + A.d);
    const relAt = Math.max(t0 + A.a + A.h + A.d, end - A.r - 0.01);
    if (A.s > 0) { g.setValueAtTime(sus, relAt); g.exponentialRampToValueAtTime(1e-4, relAt + A.r); }
    else g.exponentialRampToValueAtTime(1e-5, Math.min(end, t0 + A.a + A.h + A.d + A.r));
  }

  // Node-based effects run inside the offline graph; "crush" and "vinyl" are finished on the samples (see finish).
  function buildFx(ctx, F, input) {
    const out = ctx.createGain();
    switch (F.type) {
      case "drive": { const pre = ctx.createGain(); pre.gain.value = 1 + F.amount * 3; const ws = ctx.createWaveShaper(); ws.curve = shapeCurve(F.amount); ws.oversample = "4x"; const post = ctx.createGain(); post.gain.value = 1 / (1 + F.amount * 1.5); input.connect(pre).connect(ws).connect(post).connect(out); break; }
            case "eq": {
        const lo = ctx.createBiquadFilter(); lo.type = "lowshelf"; lo.frequency.value = 120; lo.gain.value = F.low;
        const mi = ctx.createBiquadFilter(); mi.type = "peaking"; mi.frequency.value = F.midFreq; mi.Q.value = 0.9; mi.gain.value = F.mid;
        const hi = ctx.createBiquadFilter(); hi.type = "highshelf"; hi.frequency.value = 6000; hi.gain.value = F.high;
        input.connect(lo).connect(mi).connect(hi).connect(out); break;
      }
      case "filter": { const bq = ctx.createBiquadFilter(); bq.type = F.mode; bq.frequency.value = F.freq; bq.Q.value = F.q; input.connect(bq).connect(out); break; }
      case "compress": {
        const c = ctx.createDynamicsCompressor(); c.threshold.value = -6 - F.amount * 24; c.ratio.value = 2 + F.amount * 10; c.attack.value = 0.003; c.release.value = 0.12; c.knee.value = 6;
        const mk = ctx.createGain(); mk.gain.value = 1 + F.amount * 1.5; input.connect(c).connect(mk).connect(out); break;
      }
      case "chorus": {
        const dry = ctx.createGain(); dry.gain.value = 1 - F.mix * 0.5; input.connect(dry).connect(out);
        [0, 1].forEach((side) => {
          const dl = ctx.createDelay(0.1); dl.delayTime.value = 0.012 + side * 0.007;
          const lfo = ctx.createOscillator(); lfo.frequency.value = F.rate * (1 + side * 0.3); const lg = ctx.createGain(); lg.gain.value = 0.004 * F.depth;
          lfo.connect(lg).connect(dl.delayTime); lfo.start(0);
          const p = ctx.createStereoPanner(); p.pan.value = side ? 0.8 : -0.8; const wg = ctx.createGain(); wg.gain.value = F.mix;
          input.connect(dl).connect(wg).connect(p).connect(out);
        });
        break;
      }
      case "delay": {
        const dry = ctx.createGain(); input.connect(dry).connect(out);
        const dl = ctx.createDelay(2); dl.delayTime.value = F.time; const fb = ctx.createGain(); fb.gain.value = F.feedback;
        const tone = ctx.createBiquadFilter(); tone.type = "lowpass"; tone.frequency.value = 5000;
        const wet = ctx.createGain(); wet.gain.value = F.mix;
        input.connect(dl).connect(tone).connect(fb).connect(dl); tone.connect(wet).connect(out); break;
      }
      case "reverb": {
        const dry = ctx.createGain(); dry.gain.value = 1 - F.mix * 0.4; input.connect(dry).connect(out);
        const cv = ctx.createConvolver(); cv.buffer = reverbIR(ctx, F.size, F.decay);
        const wet = ctx.createGain(); wet.gain.value = F.mix * 0.8; input.connect(cv).connect(wet).connect(out); break;
      }
      case "width": {
        // Haas-style widening: delay one side a few ms
        const split = ctx.createChannelSplitter(2), merge = ctx.createChannelMerger(2), dl = ctx.createDelay(0.05);
        dl.delayTime.value = 0.002 + F.amount * 0.018;
        input.connect(split); split.connect(merge, 0, 0); split.connect(dl, 1).connect(merge, 0, 1); merge.connect(out); break;
      }
      default: input.connect(out);
    }
    return out;
  }

  // Sample-domain finishing: level, trim, then crush and vinyl (always last, in their listed order),
  // then fade and final level. Crush runs on a full-level signal so quiet sounds don't turn to static.
  function finish(buf, R, ctx) {
    const sr = buf.sampleRate;
    let ch = [0, 1].map((c) => Float32Array.from(buf.getChannelData(Math.min(c, buf.numberOfChannels - 1))));
    const peakOf = () => { let p = 0; ch.forEach((d) => { for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > p) p = a; } }); return p; };
    const scale = (k) => ch.forEach((d) => { for (let i = 0; i < d.length; i++) d[i] *= k; });
    let peak = peakOf();
    if (peak < 1e-7) return buf; // silent recipe: nothing to shape
    scale(1 / peak);
    // Start the sound on its first audible sample (the compressor's lookahead and layer offsets add a gap).
    let first = 0; const n0 = ch[0].length;
    while (first < n0 && Math.abs(ch[0][first]) < 1e-3 && Math.abs(ch[1][first]) < 1e-3) first++;
    first = Math.max(0, first - Math.round(sr * 0.0005));
    if (first > 0) ch = ch.map((d) => d.subarray(first));
    for (const F of R.fx) {
      if (F.type === "crush") {
        const steps = Math.pow(2, F.bits - 1), step = 1 / F.rate;
        ch.forEach((d) => {
          let hold = 0, acc = step;
          for (let i = 0; i < d.length; i++) {
            if (acc >= step) { hold = F.bits < 16 ? Math.round(d[i] * steps) / steps : d[i]; acc -= step; }
            d[i] = hold; acc += 1;
          }
        });
      }
      if (F.type === "vinyl") { // hiss and crackle that ride on the sound itself, plus a faint floor
        let lp = 0, envf = 0; const att = 1 - Math.exp(-1 / (0.002 * sr)), rel = 1 - Math.exp(-1 / (0.08 * sr));
        for (let i = 0; i < ch[0].length; i++) {
          const a = Math.abs(ch[0][i]); envf += (a > envf ? att : rel) * (a - envf);
          const live = Math.min(1, envf * 2) * 0.85 + 0.15;
          const w = Math.random() * 2 - 1; lp += 0.08 * (w - lp);
          let v = lp * F.hiss * 0.08 * live;
          if (Math.random() < F.crackle * 0.0008 * live) v += (Math.random() * 2 - 1) * 0.3 * F.crackle * live;
          ch[0][i] += v; ch[1][i] += v * 0.9;
        }
      }
    }
    // Drop the silent end (below -80 dB), keep at least 50 ms, then fade and set the final level.
    let last = ch[0].length - 1;
    while (last > sr * 0.05 && Math.abs(ch[0][last]) < 1e-4 && Math.abs(ch[1][last]) < 1e-4) last--;
    ch = ch.map((d) => d.subarray(0, last + 1));
    const fade = Math.min(ch[0].length >> 1, Math.floor(R.out.fade * sr));
    ch.forEach((d) => { for (let i = 0; i < fade; i++) d[d.length - 1 - i] *= i / fade; });
    peak = peakOf();
    if (peak > 1e-7) scale(Math.pow(10, R.out.level / 20) / peak);
    const out = ctx.createBuffer(2, ch[0].length, sr);
    out.getChannelData(0).set(ch[0]); out.getChannelData(1).set(ch[1]);
    return out;
  }

  /** Render a recipe. opts.OfflineAudioContext lets Node pass its own class. Resolves { buffer, recipe, warnings }. */
  async function render(input, opts) {
    const o = opts || {};
    const { recipe: R, warnings } = check(input);
    const OAC = o.OfflineAudioContext || root.OfflineAudioContext || root.webkitOfflineAudioContext;
    if (!OAC) throw new Error("No OfflineAudioContext here.");
    const sr = o.sampleRate || SR;
    const ctx = new OAC(2, Math.ceil(R.length * sr), sr);
    const mix = ctx.createGain(); mix.gain.value = 1;
    R.layers.forEach((L) => buildLayer(ctx, L, R, mix));
    let head = mix;
    R.fx.forEach((F) => { head = buildFx(ctx, F, head); });
    head.connect(ctx.destination);
    const buffer = await ctx.startRendering();
    return { buffer: finish(buffer, R, ctx), recipe: R, warnings };
  }

  /** AudioBuffer -> WAV bytes (16 or 24 bit PCM). */
  function wav(buffer, bits) {
    const b = bits === 16 ? 16 : 24, nc = buffer.numberOfChannels, n = buffer.length, bps = b / 8;
    const data = n * nc * bps, ab = new ArrayBuffer(44 + data), v = new DataView(ab);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, "RIFF"); v.setUint32(4, 36 + data, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, nc, true); v.setUint32(24, buffer.sampleRate, true);
    v.setUint32(28, buffer.sampleRate * nc * bps, true); v.setUint16(32, nc * bps, true); v.setUint16(34, b, true);
    w(36, "data"); v.setUint32(40, data, true);
    const chans = Array.from({ length: nc }, (_, c) => buffer.getChannelData(c));
    let off = 44; const max = Math.pow(2, b - 1) - 1;
    for (let i = 0; i < n; i++) for (let c = 0; c < nc; c++) {
      const s = Math.round(Math.max(-1, Math.min(1, chans[c][i])) * max);
      if (b === 16) v.setInt16(off, s, true); else { v.setUint8(off, s & 255); v.setUint8(off + 1, (s >> 8) & 255); v.setUint8(off + 2, (s >> 16) & 255); }
      off += bps;
    }
    return ab;
  }

  const api = { check, render, wav, limits: { MAX_LEN, MAX_LAYERS, MAX_FX } };
  root.LoopwrightSoundMaker = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
