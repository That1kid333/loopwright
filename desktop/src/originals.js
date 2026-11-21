/* Loopwright Originals: electronic sounds made in code. Nothing to download, nothing to license.
 *
 * They fill the gaps the free recorded packs leave: 808 and genre drum kits, synth bass,
 * leads, pads, plucks, electric keys, a plucked-string guitar, vowel vocal chops and FX.
 * library.js lists them next to the recorded packs and plays them through the same player
 * shape, so the studio does not need to know which is which.
 *
 * Every sound is generated live with the Web Audio API (oscillators, filters, noise and a
 * Karplus-Strong string), so it works offline and costs no storage.
 */
window.LoopwrightOriginals = (function () {
  const pack = {
    id: "originals", name: "Loopwright Originals", author: "Loopwright",
    license: "Made in code by Loopwright. Free to use in any song, with no credit needed.",
    source_url: null, page_url: null,
    about: "Electronic drums, bass, synths, keys, guitar, vocal chops and FX, generated live in the app.",
    file_count: 0, item_count: 0,
  };

  // ---------- shared helpers ----------
  const per = new WeakMap(); // ctx -> {noise, curves, waves, ks}
  function S(ctx) {
    if (!per.has(ctx)) {
      const len = ctx.sampleRate * 2, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      per.set(ctx, { noise: b, curves: new Map(), waves: new Map(), ks: new Map() });
    }
    return per.get(ctx);
  }
  const mtof = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const clampF = (f) => Math.max(20, Math.min(18000, f));
  const velGain = (v) => Math.pow(Math.max(1, Math.min(127, v)) / 127, 1.6) * 0.9 + 0.1;

  function noise(ctx, when, len) {
    const s = ctx.createBufferSource(); s.buffer = S(ctx).noise; s.loop = true;
    s.start(when, Math.random() * 1.5); if (len) s.stop(when + len); return s;
  }
  function osc(ctx, type, f, when, stopAt) {
    const o = ctx.createOscillator();
    if (type.startsWith("pulse")) o.setPeriodicWave(pulse(ctx, Number(type.slice(5)) || 0.25)); else o.type = type;
    o.frequency.value = f; o.start(when); if (stopAt) o.stop(stopAt); return o;
  }
  function pulse(ctx, w) {
    const m = S(ctx).waves, k = w.toFixed(3);
    if (!m.has(k)) {
      const n = 64, re = new Float32Array(n), im = new Float32Array(n);
      for (let i = 1; i < n; i++) re[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * w);
      m.set(k, ctx.createPeriodicWave(re, im));
    }
    return m.get(k);
  }
  function drive(ctx, amt) {
    const m = S(ctx).curves, k = amt.toFixed(2);
    if (!m.has(k)) {
      const c = new Float32Array(1024), q = 1 + amt * 20, t = Math.tanh(q);
      for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; c[i] = Math.tanh(q * x) / t; }
      m.set(k, c);
    }
    const ws = ctx.createWaveShaper(); ws.curve = m.get(k); ws.oversample = "2x"; return ws;
  }
  function filt(ctx, type, f, q) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = clampF(f); b.Q.value = q == null ? 0.7 : q; return b; }
  function env(param, when, peak, a, d, sus) {
    param.setValueAtTime(0.0001, when);
    param.linearRampToValueAtTime(peak, when + Math.max(0.001, a));
    param.setTargetAtTime(Math.max(0.0001, peak * sus), when + a, Math.max(0.005, d / 4));
  }
  function decay(param, when, peak, d, a) {
    param.setValueAtTime(0.0001, when);
    param.linearRampToValueAtTime(peak, when + (a || 0.002));
    param.exponentialRampToValueAtTime(0.0001, when + (a || 0.002) + d);
  }

  // ---------- drum and FX hits ----------
  // Each returns the time it ends, so sources can be stopped.
  const HIT = {
    kick(ctx, H, out, t) {
      const o = osc(ctx, "sine", H.f0 || 150, t, t + H.d + 0.1);
      o.frequency.setValueAtTime(H.f0 || 150, t); o.frequency.exponentialRampToValueAtTime(H.f1 || 48, t + (H.pd || 0.07));
      const g = ctx.createGain(); decay(g.gain, t, 1, H.d || 0.5); o.connect(g).connect(out);
      if (H.click) { const n = noise(ctx, t, 0.02), hp = filt(ctx, "highpass", 2500), cg = ctx.createGain(); decay(cg.gain, t, H.click, 0.015); n.connect(hp).connect(cg).connect(out); }
      return t + H.d;
    },
    snare(ctx, H, out, t) {
      const o = osc(ctx, "triangle", H.f || 185, t, t + 0.3), og = ctx.createGain();
      o.frequency.exponentialRampToValueAtTime((H.f || 185) * 0.8, t + 0.05);
      decay(og.gain, t, H.tone == null ? 0.6 : H.tone, H.td || 0.1); o.connect(og).connect(out);
      const n = noise(ctx, t, (H.nd || 0.2) + 0.1), f = filt(ctx, "highpass", H.nf || 1800), f2 = filt(ctx, "lowpass", H.nl || 9000), ng = ctx.createGain();
      decay(ng.gain, t, H.noise == null ? 0.8 : H.noise, H.nd || 0.2); n.connect(f).connect(f2).connect(ng).connect(out);
      if (H.gate) { ng.gain.cancelScheduledValues(t + H.gate); ng.gain.setValueAtTime(0.5, t + H.gate); ng.gain.linearRampToValueAtTime(0.0001, t + H.gate + 0.01); }
      return t + Math.max(H.nd || 0.2, H.td || 0.1);
    },
    clap(ctx, H, out, t) {
      const n = noise(ctx, t, (H.d || 0.3) + 0.1), bp = filt(ctx, "bandpass", H.f || 1200, 1.2), g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      for (let i = 0; i < 3; i++) { const s = t + i * (H.sp || 0.011); g.gain.setValueAtTime(1, s); g.gain.exponentialRampToValueAtTime(0.2, s + 0.009); }
      g.gain.setValueAtTime(0.9, t + 3 * (H.sp || 0.011)); g.gain.exponentialRampToValueAtTime(0.0001, t + 3 * (H.sp || 0.011) + (H.d || 0.3));
      n.connect(bp).connect(g).connect(out); return t + (H.d || 0.3) + 0.04;
    },
    hat(ctx, H, out, t) {
      const d = H.d || 0.06, g = ctx.createGain(), bp = filt(ctx, "bandpass", H.bp || 10000, 0.8), hp = filt(ctx, "highpass", H.hp || 7000);
      bp.connect(hp).connect(g).connect(out);
      const base = H.f || 40;
      [2, 3, 4.16, 5.43, 6.79, 8.21].forEach((r) => osc(ctx, "square", base * r, t, t + d + 0.05).connect(bp));
      if (H.noise) { const n = noise(ctx, t, d + 0.05), ng = ctx.createGain(); ng.gain.value = H.noise; n.connect(ng).connect(bp); }
      decay(g.gain, t, 0.5, d); return t + d;
    },
    tom(ctx, H, out, t) {
      const f = H.f || 120, o = osc(ctx, "sine", f * 1.6, t, t + H.d + 0.1), g = ctx.createGain();
      o.frequency.exponentialRampToValueAtTime(f, t + 0.08); decay(g.gain, t, 1, H.d || 0.4); o.connect(g).connect(out);
      return t + (H.d || 0.4);
    },
    rim(ctx, H, out, t) {
      const o = osc(ctx, "triangle", H.f || 1700, t, t + 0.06), g = ctx.createGain(), bp = filt(ctx, "bandpass", H.f || 1700, 3);
      decay(g.gain, t, 1, 0.04); o.connect(bp).connect(g).connect(out); return t + 0.05;
    },
    cow(ctx, H, out, t) {
      const g = ctx.createGain(), bp = filt(ctx, "bandpass", H.bp || 2000, 1.5);
      osc(ctx, "square", H.f || 540, t, t + 0.5).connect(bp); osc(ctx, "square", (H.f || 540) * 1.48, t, t + 0.5).connect(bp);
      bp.connect(g).connect(out); decay(g.gain, t, 0.6, H.d || 0.3); return t + (H.d || 0.3);
    },
    shaker(ctx, H, out, t) {
      const d = H.d || 0.09, n = noise(ctx, t, d + 0.05), hp = filt(ctx, "highpass", H.hp || 6000), g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.7, t + (H.a || 0.02)); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      n.connect(hp).connect(g).connect(out); return t + d;
    },
    perc(ctx, H, out, t) { // conga / bongo / clave
      const f = H.f || 300, o = osc(ctx, H.w || "sine", f * (H.bend || 1.3), t, t + (H.d || 0.25) + 0.05), g = ctx.createGain();
      o.frequency.exponentialRampToValueAtTime(f, t + 0.03); decay(g.gain, t, 1, H.d || 0.25); o.connect(g).connect(out); return t + (H.d || 0.25);
    },
    riser(ctx, H, out, t) {
      const L = H.len || 4, n = noise(ctx, t, L), bp = filt(ctx, "bandpass", H.f0 || 300, H.q || 2), g = ctx.createGain();
      bp.frequency.setValueAtTime(H.f0 || 300, t); bp.frequency.exponentialRampToValueAtTime(H.f1 || 9000, t + L);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + L - 0.02); g.gain.linearRampToValueAtTime(0.0001, t + L);
      n.connect(bp).connect(g).connect(out);
      if (H.tone) { const o = osc(ctx, "sawtooth", 110, t, t + L), og = ctx.createGain(); o.frequency.exponentialRampToValueAtTime(110 * Math.pow(2, H.tone), t + L); og.gain.value = 0.12; o.connect(og).connect(bp); }
      return t + L;
    },
    down(ctx, H, out, t) {
      const L = H.len || 2, n = noise(ctx, t, L), bp = filt(ctx, "bandpass", H.f0 || 8000, 1.5), g = ctx.createGain();
      bp.frequency.setValueAtTime(H.f0 || 8000, t); bp.frequency.exponentialRampToValueAtTime(H.f1 || 150, t + L);
      g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + L);
      n.connect(bp).connect(g).connect(out); return t + L;
    },
    reverse(ctx, H, out, t) { // reversed cymbal swell
      const L = H.len || 1.5, n = noise(ctx, t, L), hp = filt(ctx, "highpass", 5000), g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.8, t + L - 0.01); g.gain.linearRampToValueAtTime(0.0001, t + L);
      n.connect(hp).connect(g).connect(out); return t + L;
    },
    impact(ctx, H, out, t) {
      const d = H.d || 2.5; HIT.kick(ctx, { f0: 120, f1: 30, pd: 0.4, d, click: 0.6 }, out, t);
      const n = noise(ctx, t, d), lp = filt(ctx, "lowpass", H.lp || 1200), g = ctx.createGain(); decay(g.gain, t, 0.7, d * 0.6);
      n.connect(lp).connect(g).connect(out); return t + d;
    },
    zap(ctx, H, out, t) {
      const d = H.d || 0.25, o = osc(ctx, H.w || "square", H.f0 || 3000, t, t + d + 0.05), g = ctx.createGain(), lp = filt(ctx, "lowpass", 6000);
      o.frequency.exponentialRampToValueAtTime(H.f1 || 80, t + d); decay(g.gain, t, 0.5, d); o.connect(lp).connect(g).connect(out); return t + d;
    },
    sweep(ctx, H, out, t) {
      const L = H.len || 0.8, n = noise(ctx, t, L), bp = filt(ctx, "bandpass", H.f0 || 400, 4), g = ctx.createGain();
      bp.frequency.setValueAtTime(H.f0 || 400, t); bp.frequency.exponentialRampToValueAtTime(H.f1 || 8000, t + L);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.9, t + L * 0.5); g.gain.linearRampToValueAtTime(0.0001, t + L);
      n.connect(bp).connect(g).connect(out); return t + L;
    },
  };

  function playHit(ctx, H, vel, when, opt) {
    const t = Math.max(when || 0, ctx.currentTime), dest = opt.destination || ctx.destination;
    const g = ctx.createGain(); g.gain.value = (H.g == null ? 1 : H.g) * velGain(vel) * (opt.gain == null ? 1 : opt.gain) * 0.8;
    let head = g;
    if (H.drive) { const ws = drive(ctx, H.drive); head = ws; ws.connect(g); }
    if (H.lp) { const lp = filt(ctx, "lowpass", H.lp); lp.connect(head); head = lp; }
    g.connect(dest);
    const tune = Math.pow(2, (opt.tune || 0) / 1200);
    const p = tune === 1 ? H : scaleHit(H, tune);
    const end = HIT[p.t](ctx, p, head, t);
    return { end, stop(at) { const s = at || ctx.currentTime; g.gain.cancelScheduledValues(s); g.gain.setValueAtTime(g.gain.value, s); g.gain.linearRampToValueAtTime(0.0001, s + 0.05); } };
  }
  function scaleHit(H, r) { const o = { ...H }; for (const k of ["f", "f0", "f1", "bp"]) if (o[k]) o[k] *= r; return o; }

  // ---------- pitched voices ----------
  const VOWELS = {
    low: { a: [600, 1040, 2250], e: [400, 1620, 2400], i: [250, 1750, 2600], o: [400, 750, 2400], u: [350, 600, 2400] },
    high: { a: [800, 1150, 2900], e: [350, 2000, 2800], i: [270, 2140, 2950], o: [450, 800, 2830], u: [325, 700, 2700] },
  };

  function ksBuffer(ctx, f, P, vel) {
    const cache = S(ctx).ks, key = f.toFixed(2) + "|" + P.ks.t60 + "|" + P.ks.bright + "|" + Math.round(vel / 32);
    if (cache.has(key)) return cache.get(key);
    const sr = ctx.sampleRate, N = Math.max(2, Math.floor(sr / f - 0.5)), len = Math.floor(sr * Math.min(6, P.ks.t60 + 0.5));
    const b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0), ring = new Float32Array(N);
    const a = Math.min(0.98, 0.15 + 0.8 * (P.ks.bright == null ? 0.5 : P.ks.bright) * (0.4 + vel / 160));
    let lp = 0; for (let i = 0; i < N; i++) { lp += a * (Math.random() * 2 - 1 - lp); ring[i] = lp; }
    const loss = Math.pow(0.001, 1 / ((sr / N) * P.ks.t60)); let idx = 0;
    for (let i = 0; i < len; i++) { const cur = ring[idx], nx = ring[(idx + 1) % N]; d[i] = cur; ring[idx] = loss * 0.5 * (cur + nx); idx = (idx + 1) % N; }
    const out = { buf: b, rate: f / (sr / (N + 0.5)) };
    cache.set(key, out); return out;
  }

  function playNote(ctx, P, note, vel, when, opt) {
    const t = Math.max(when || 0, ctx.currentTime), f = mtof(note), dest = opt.destination || ctx.destination;
    const A = P.amp || { a: 0.005, d: 0.3, s: 0.7, r: 0.2 };
    const hold = opt.duration || (A.s > 0 ? 8 : 0);
    const peak = (P.g == null ? 0.35 : P.g) * velGain(vel) * (opt.gain == null ? 1 : opt.gain);
    const amp = ctx.createGain(); amp.connect(dest);
    let head = amp, filter = null;
    if (P.filter) {
      const F = P.filter, base = F.f * Math.pow(2, (F.track == null ? 0.5 : F.track) * (note - 60) / 12) * Math.pow(2, (F.vel || 0) * (vel / 127 - 0.7));
      filter = filt(ctx, F.type || "lowpass", base, F.q); filter.connect(head); head = filter;
      if (F.env) { filter.frequency.setValueAtTime(clampF(base * Math.pow(2, F.env)), t + (F.a || 0)); filter.frequency.setTargetAtTime(clampF(base), t + (F.a || 0), Math.max(0.01, (F.d || 0.3) / 3)); }
    }
    if (P.drive) { const ws = drive(ctx, P.drive); ws.connect(head); head = ws; }
    if (P.formant) { // vowel chop: parallel band-pass bank
      const bank = ctx.createGain(); const set = VOWELS[P.voice || "high"][P.formant];
      set.forEach((fr, i) => { const bp = filt(ctx, "bandpass", fr, fr / [80, 90, 120][i]); const g = ctx.createGain(); g.gain.value = [1.6, 0.9, 0.5][i] * 3; bank.connect(bp).connect(g).connect(head); });
      head = bank;
    }
    const sources = [];
    const end = t + hold + A.r;
    const stopAll = (at) => sources.forEach((s) => { try { s.stop(at); } catch (e) { /* already stopped */ } });

    if (P.ks) {
      const k = ksBuffer(ctx, f, P, vel), s = ctx.createBufferSource(); s.buffer = k.buf; s.playbackRate.value = k.rate;
      const g = ctx.createGain(); g.gain.value = 2.2; s.connect(g).connect(head); s.start(t); sources.push(s);
    } else {
      const oscs = P.osc || [{ w: "sawtooth" }];
      for (const O of oscs) {
        const U = O.uni || 1, spread = O.spread || 0, gl = (O.g == null ? 1 : O.g) / Math.sqrt(U);
        for (let u = 0; u < U; u++) {
          const o = osc(ctx, O.w || "sawtooth", f * Math.pow(2, O.oct || 0), t);
          o.detune.value = (O.det || 0) + (U > 1 ? (u / (U - 1) - 0.5) * spread : 0);
          const g = ctx.createGain(); g.gain.value = gl; o.connect(g).connect(head); sources.push(o);
          if (P.fm) {
            const m = osc(ctx, "sine", f * P.fm.ratio, t), mg = ctx.createGain();
            const idx = f * P.fm.index * (0.5 + vel / 254);
            mg.gain.setValueAtTime(idx, t); mg.gain.setTargetAtTime(idx * (P.fm.sus || 0.1), t, Math.max(0.01, (P.fm.decay || 0.4) / 3));
            m.connect(mg).connect(o.frequency); sources.push(m);
          }
          if (P.vib) { const l = osc(ctx, "sine", P.vib.rate || 5.5, t + (P.vib.delay || 0.15)), lg = ctx.createGain(); lg.gain.value = P.vib.depth || 12; l.connect(lg).connect(o.detune); sources.push(l); }
        }
      }
      if (P.noise) { const n = noise(ctx, t), ng = ctx.createGain(); ng.gain.value = P.noise; n.connect(ng).connect(head); sources.push(n); }
      if (P.sub) { const o = osc(ctx, "sine", f / 2, t), g = ctx.createGain(); g.gain.value = P.sub; o.connect(g).connect(amp); sources.push(o); }
    }
    if (P.lfo && filter) {
      const l = osc(ctx, P.lfo.w || "sine", P.lfo.rate || 2, t), lg = ctx.createGain(); lg.gain.value = P.lfo.depth || 600;
      l.connect(lg).connect(filter.frequency); sources.push(l);
    }
    if (P.glide) { // 808-style slide down into the note
      sources.forEach((s) => { if (s.frequency && !s.buffer) { s.detune.setValueAtTime((s.detune.value || 0) + 1200 * P.glide, t); s.detune.setTargetAtTime(s.detune.value || 0, t, 0.04); } });
    }

    // amplitude envelope
    env(amp.gain, t, peak, A.a, A.d, A.s);
    if (A.s > 0 || opt.duration) {
      const rel = opt.release == null ? A.r : opt.release;
      amp.gain.cancelScheduledValues(t + hold); amp.gain.setTargetAtTime(0.0001, t + hold, Math.max(0.01, rel / 4));
      stopAll(t + hold + rel + 0.05);
    } else {
      stopAll(t + A.d * 2.5 + 0.05);
    }
    return {
      end,
      stop(at) {
        const s = Math.max(at || ctx.currentTime, t), r = opt.release == null ? A.r : opt.release;
        amp.gain.cancelScheduledValues(s); amp.gain.setValueAtTime(amp.gain.value, s); amp.gain.setTargetAtTime(0.0001, s, Math.max(0.01, r / 4)); stopAll(s + r + 0.05);
      },
    };
  }

  // ---------- presets ----------
  const items = [];
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  function addInst(name, category, sub, tags, P, range) {
    items.push({ id: "orig-" + slug(name), pack_id: "originals", name, kind: "instrument", category, subcategory: sub,
      tags: ["made in code", "electronic"].concat(tags), preview_path: null, key_low: range ? range[0] : 24, key_high: range ? range[1] : 96,
      zone_count: 1, make: P });
  }
  function addKit(name, category, sub, tags, hits) {
    items.push({ id: "orig-" + slug(name), pack_id: "originals", name, kind: "kit", category, subcategory: sub,
      tags: ["made in code", "electronic"].concat(tags), preview_path: null, key_low: null, key_high: null,
      zone_count: hits.length, hits: hits.map((h) => ({ name: h.name, key: h.key })), make: { hits } });
  }
  // a tone variant of an instrument: darker or brighter filter
  function variant(P, mul, envAdd) { const Q = JSON.parse(JSON.stringify(P)); if (Q.filter) { Q.filter.f *= mul; Q.filter.env = (Q.filter.env || 0) + envAdd; } return Q; }
  function addWithVariants(name, category, sub, tags, P, range) {
    addInst(name, category, sub, tags, P, range);
    if (P.filter && !P.formant) {
      addInst(name + " (dark)", category, sub, tags.concat(["dark"]), variant(P, 0.45, -0.5), range);
      addInst(name + " (bright)", category, sub, tags.concat(["bright"]), variant(P, 2.2, 0.5), range);
    }
  }

  // Drum kits. Keys follow General MIDI, so a kit plays from any keyboard or MIDI file.
  const K = (name, key, h) => ({ name, key, ...h });
  function kit(o) {
    const lp = o.lp, dr = o.drive;
    const fx = (h) => ({ ...h, lp: h.lp || lp, drive: h.drive || dr });
    return [
      K("Kick", 36, fx({ t: "kick", ...o.kick })),
      K("Kick 2", 35, fx({ t: "kick", ...o.kick, ...(o.kick2 || { d: (o.kick.d || 0.5) * 0.6, f0: (o.kick.f0 || 150) * 1.2 }) })),
      K("Snare", 38, fx({ t: "snare", ...o.snare })),
      K("Snare 2", 40, fx({ t: "snare", ...o.snare, ...(o.snare2 || { f: (o.snare.f || 185) * 1.15, nd: (o.snare.nd || 0.2) * 0.7 }) })),
      K("Clap", 39, fx({ t: "clap", ...o.clap })),
      K("Rim", 37, fx({ t: "rim", ...o.rim })),
      K("Closed hat", 42, fx({ t: "hat", ...o.hat })),
      K("Pedal hat", 44, fx({ t: "hat", ...o.hat, d: (o.hat.d || 0.06) * 0.6 })),
      K("Open hat", 46, fx({ t: "hat", ...o.hat, d: o.open || 0.35 })),
      K("Low tom", 45, fx({ t: "tom", f: (o.tom || 110) * 0.8, d: 0.45 })),
      K("Mid tom", 47, fx({ t: "tom", f: o.tom || 110, d: 0.4 })),
      K("High tom", 50, fx({ t: "tom", f: (o.tom || 110) * 1.3, d: 0.35 })),
      K("Crash", 49, fx({ t: "hat", f: 38, hp: 4500, bp: 8000, d: 1.8, noise: 0.6 })),
      K("Ride", 51, fx({ t: "hat", f: 52, hp: 6000, bp: 9000, d: 1.2, g: 0.6 })),
      K("Cowbell", 56, fx({ t: "cow", ...(o.cow || {}) })),
      K("Shaker", 70, fx({ t: "shaker", ...(o.shaker || {}) })),
      K("Conga", 63, fx({ t: "perc", f: 330, d: 0.22 })),
      K("Clave", 75, fx({ t: "perc", f: 2500, d: 0.05, bend: 1, w: "triangle" })),
    ];
  }
  const KITS = [
    ["808 Classic Kit", ["hip hop", "trap", "r&b", "pop", "80s"], { kick: { f0: 120, f1: 45, pd: 0.1, d: 1.2 }, snare: { f: 190, td: 0.12, nd: 0.18, tone: 0.7, noise: 0.6 }, clap: { d: 0.25 }, hat: { d: 0.05, f: 42 }, open: 0.4 }],
    ["Trap Kit", ["trap", "hip hop", "drill"], { kick: { f0: 160, f1: 42, pd: 0.09, d: 1.6, click: 0.3 }, drive: 0.15, snare: { f: 230, td: 0.08, nd: 0.15, nf: 2500 }, clap: { d: 0.35, f: 1400 }, hat: { d: 0.035, f: 46, hp: 8000 }, open: 0.3 }],
    ["Drill Kit", ["drill", "uk drill", "trap"], { kick: { f0: 140, f1: 40, pd: 0.12, d: 1.8 }, drive: 0.25, snare: { f: 260, td: 0.06, nd: 0.12, nf: 3000, tone: 0.4 }, clap: { d: 0.18 }, hat: { d: 0.03, f: 48, hp: 9000 }, open: 0.25, tom: 140 }],
    ["909-Style House Kit", ["house", "deep house", "tech house", "disco"], { kick: { f0: 200, f1: 52, pd: 0.05, d: 0.45, click: 0.5 }, snare: { f: 200, td: 0.08, nd: 0.25, noise: 0.9 }, clap: { d: 0.3 }, hat: { d: 0.07, f: 44, noise: 0.3 }, open: 0.45 }],
    ["Techno Kit", ["techno", "industrial", "minimal"], { kick: { f0: 230, f1: 48, pd: 0.04, d: 0.55, click: 0.7 }, drive: 0.35, snare: { f: 170, td: 0.07, nd: 0.2, nf: 2200 }, clap: { d: 0.4, f: 1000 }, hat: { d: 0.04, f: 50, hp: 9000 }, open: 0.3, tom: 90 }],
    ["Boom Bap Kit", ["boom bap", "hip hop", "90s"], { lp: 7000, kick: { f0: 110, f1: 52, pd: 0.06, d: 0.35, click: 0.4 }, drive: 0.2, snare: { f: 180, td: 0.1, nd: 0.22, nf: 1500, nl: 7000, noise: 1 }, clap: { d: 0.22 }, hat: { d: 0.05, f: 38, noise: 0.5, hp: 6000 }, open: 0.3 }],
    ["Lo-fi Kit", ["lo-fi", "chill", "jazz hop"], { lp: 3800, kick: { f0: 100, f1: 50, pd: 0.06, d: 0.3 }, drive: 0.3, snare: { f: 170, td: 0.1, nd: 0.18, nf: 1200, noise: 0.7 }, clap: { d: 0.2 }, hat: { d: 0.04, f: 36, noise: 0.6, hp: 5000 }, open: 0.25, shaker: { d: 0.12, hp: 4000 } }],
    ["Reggaeton Kit", ["reggaeton", "dembow", "latin"], { kick: { f0: 150, f1: 50, pd: 0.06, d: 0.5, click: 0.3 }, snare: { f: 240, td: 0.06, nd: 0.14, nf: 2800, tone: 0.8 }, clap: { d: 0.2, f: 1500 }, hat: { d: 0.04, f: 44 }, open: 0.3, rim: { f: 1900 } }],
    ["Afrobeats Kit", ["afrobeats", "amapiano", "afro house"], { kick: { f0: 130, f1: 50, pd: 0.07, d: 0.6 }, snare: { f: 300, td: 0.05, nd: 0.1, nf: 3200, tone: 0.5 }, clap: { d: 0.18 }, hat: { d: 0.03, f: 46 }, open: 0.2, shaker: { d: 0.07, hp: 7000 }, rim: { f: 2100 } }],
    ["Amapiano Log Kit", ["amapiano", "afrobeats", "house"], { kick: { f0: 110, f1: 48, pd: 0.1, d: 0.9 }, snare: { f: 220, td: 0.07, nd: 0.12 }, clap: { d: 0.25 }, hat: { d: 0.035, f: 44 }, open: 0.25, tom: 70, shaker: { d: 0.06 } }],
    ["Pop Kit", ["pop", "dance pop", "edm"], { kick: { f0: 180, f1: 50, pd: 0.05, d: 0.5, click: 0.5 }, drive: 0.1, snare: { f: 210, td: 0.09, nd: 0.25, noise: 0.9 }, clap: { d: 0.3, f: 1300 }, hat: { d: 0.05, f: 45 }, open: 0.35 }],
    ["Synthwave Kit", ["synthwave", "80s", "retro"], { kick: { f0: 170, f1: 50, pd: 0.05, d: 0.45, click: 0.4 }, snare: { f: 180, td: 0.12, nd: 0.6, noise: 1, gate: 0.25 }, clap: { d: 0.5 }, hat: { d: 0.05, f: 40 }, open: 0.4, tom: 100 }],
    ["Rock Electronic Kit", ["rock", "indie", "big beat"], { kick: { f0: 140, f1: 55, pd: 0.04, d: 0.4, click: 0.8 }, drive: 0.4, snare: { f: 200, td: 0.15, nd: 0.35, noise: 1, nf: 1200 }, clap: { d: 0.3 }, hat: { d: 0.08, f: 36, noise: 0.5 }, open: 0.5, tom: 95 }],
    ["Dancehall Kit", ["dancehall", "reggae", "caribbean"], { kick: { f0: 140, f1: 48, pd: 0.06, d: 0.55 }, snare: { f: 320, td: 0.05, nd: 0.12, nf: 3500, tone: 0.8 }, clap: { d: 0.2 }, hat: { d: 0.03, f: 50 }, open: 0.2, rim: { f: 2300 } }],
    ["Jersey Club Kit", ["jersey club", "club", "baltimore"], { kick: { f0: 170, f1: 50, pd: 0.05, d: 0.35, click: 0.4 }, snare: { f: 250, td: 0.07, nd: 0.16 }, clap: { d: 0.25 }, hat: { d: 0.035, f: 46 }, open: 0.3 }],
    ["Phonk Kit", ["phonk", "drift phonk", "memphis"], { kick: { f0: 150, f1: 42, pd: 0.1, d: 1.4 }, drive: 0.5, snare: { f: 230, td: 0.06, nd: 0.15 }, clap: { d: 0.3 }, hat: { d: 0.03, f: 48 }, open: 0.3, cow: { f: 560, d: 0.45, bp: 2200 } }],
    ["UK Garage Kit", ["uk garage", "2-step", "speed garage"], { kick: { f0: 160, f1: 50, pd: 0.05, d: 0.4, click: 0.4 }, snare: { f: 240, td: 0.07, nd: 0.2 }, clap: { d: 0.25 }, hat: { d: 0.045, f: 44, noise: 0.3 }, open: 0.3, shaker: { d: 0.06 } }],
    ["Drum and Bass Kit", ["drum and bass", "jungle", "breakbeat"], { kick: { f0: 190, f1: 55, pd: 0.035, d: 0.3, click: 0.7 }, drive: 0.2, snare: { f: 220, td: 0.1, nd: 0.25, noise: 1, nf: 1600 }, clap: { d: 0.25 }, hat: { d: 0.04, f: 46 }, open: 0.3 }],
    ["Dubstep Kit", ["dubstep", "riddim", "bass music"], { kick: { f0: 170, f1: 45, pd: 0.06, d: 0.6, click: 0.6 }, drive: 0.3, snare: { f: 200, td: 0.12, nd: 0.4, noise: 1, nf: 1400 }, clap: { d: 0.35 }, hat: { d: 0.04, f: 44 }, open: 0.3 }],
    ["Minimal Kit", ["minimal", "micro house", "tech house"], { kick: { f0: 180, f1: 55, pd: 0.03, d: 0.25, click: 0.3 }, snare: { f: 260, td: 0.04, nd: 0.08, nf: 3500, tone: 0.5 }, clap: { d: 0.15, f: 1600 }, hat: { d: 0.025, f: 52, hp: 10000 }, open: 0.15, rim: { f: 2500 } }],
    ["Disco Funk Kit", ["disco", "funk", "nu disco"], { lp: 9000, kick: { f0: 130, f1: 58, pd: 0.04, d: 0.3, click: 0.5 }, snare: { f: 200, td: 0.1, nd: 0.2, noise: 0.9 }, clap: { d: 0.25 }, hat: { d: 0.06, f: 40, noise: 0.5 }, open: 0.4, tom: 120 }],
    ["Gospel Chops Kit", ["gospel", "r&b", "neo soul"], { kick: { f0: 120, f1: 50, pd: 0.06, d: 0.45 }, snare: { f: 210, td: 0.09, nd: 0.2 }, clap: { d: 0.3, f: 1100 }, hat: { d: 0.05, f: 42 }, open: 0.35, tom: 115 }],
  ];
  for (const [name, tags, o] of KITS) addKit(name, "Drums", "Kit", tags, kit(o));

  addKit("Risers and Downlifters", "FX", "Risers", ["edm", "pop", "transition", "build"], [
    K("Riser 1 bar", 36, { t: "riser", len: 2 }), K("Riser 2 bars", 37, { t: "riser", len: 4, tone: 2 }),
    K("Riser 4 bars", 38, { t: "riser", len: 8, tone: 3 }), K("Tight riser", 39, { t: "riser", len: 1, f0: 800, q: 4 }),
    K("Downlifter", 40, { t: "down", len: 2 }), K("Long downlifter", 41, { t: "down", len: 4 }),
    K("Reverse cymbal", 42, { t: "reverse", len: 1.5 }), K("Short reverse", 43, { t: "reverse", len: 0.6 }),
  ]);
  addKit("Impacts and Booms", "FX", "Impacts", ["cinematic", "trailer", "edm", "transition"], [
    K("Impact", 36, { t: "impact", d: 2.5 }), K("Short impact", 37, { t: "impact", d: 1 }),
    K("Sub boom", 38, { t: "kick", f0: 70, f1: 28, pd: 1.2, d: 3, drive: 0.2 }), K("Dark hit", 39, { t: "impact", d: 3, lp: 400 }),
    K("Thud", 40, { t: "kick", f0: 90, f1: 40, pd: 0.15, d: 0.6, click: 0.8, drive: 0.4 }),
  ]);
  addKit("Lasers and Zaps", "FX", "Lasers", ["game", "dubstep", "electro", "fun"], [
    K("Laser down", 36, { t: "zap" }), K("Laser up", 37, { t: "zap", f0: 200, f1: 4000, d: 0.3 }),
    K("Short zap", 38, { t: "zap", d: 0.08, f0: 5000 }), K("Sine drop", 39, { t: "zap", w: "sine", f0: 1500, f1: 40, d: 0.6 }),
    K("Pew", 40, { t: "zap", w: "triangle", f0: 2500, f1: 300, d: 0.15 }),
  ]);
  addKit("Sweeps and Whooshes", "FX", "Transitions", ["transition", "edm", "pop", "cinematic"], [
    K("Whoosh up", 36, { t: "sweep" }), K("Whoosh down", 37, { t: "sweep", f0: 8000, f1: 300 }),
    K("Fast swish", 38, { t: "sweep", len: 0.3, f0: 1000, f1: 9000 }), K("Slow sweep", 39, { t: "sweep", len: 2.5 }),
    K("Noise burst", 40, { t: "shaker", d: 0.6, hp: 1000, a: 0.005 }),
  ]);

  // Bass
  const AMP = (a, d, s, r) => ({ a, d, s, r });
  const LP = (f, q, envOct, d, track) => ({ type: "lowpass", f, q, env: envOct, d, track: track == null ? 0.3 : track });
  [
    ["808 Bass Long", ["trap", "hip hop", "drill"], { osc: [{ w: "sine" }], drive: 0.1, amp: AMP(0.003, 2.5, 0, 0.3), g: 0.6, glide: 0.08 }],
    ["808 Bass Short", ["trap", "hip hop", "phonk"], { osc: [{ w: "sine" }], drive: 0.1, amp: AMP(0.003, 0.7, 0, 0.15), g: 0.6 }],
    ["808 Distorted", ["drill", "phonk", "rage"], { osc: [{ w: "sine" }], drive: 0.7, amp: AMP(0.003, 2, 0, 0.3), g: 0.45, glide: 0.1 }],
    ["808 Slide", ["trap", "drill", "afrobeats"], { osc: [{ w: "sine" }, { w: "triangle", g: 0.2 }], drive: 0.25, amp: AMP(0.003, 2.2, 0, 0.3), g: 0.55, glide: 0.5 }],
    ["Sub Sine", ["any", "house", "pop"], { osc: [{ w: "sine" }], amp: AMP(0.01, 0.3, 1, 0.15), g: 0.6 }],
    ["Log Drum", ["amapiano", "afro house"], { osc: [{ w: "sine" }, { w: "triangle", oct: 1, g: 0.3 }], filter: LP(800, 3, 2, 0.15), amp: AMP(0.002, 0.5, 0, 0.1), g: 0.6, glide: 0.25 }],
  ].forEach(([n, t, P]) => addInst(n, "Bass", "808 and sub", t, P, [24, 60]));
  [
    ["Analog Saw Bass", ["synthwave", "funk", "pop"], { osc: [{ w: "sawtooth" }, { w: "sawtooth", det: 8 }], filter: LP(500, 2, 2.5, 0.25), amp: AMP(0.003, 0.4, 0.6, 0.12), sub: 0.3 }],
    ["Square Funk Bass", ["funk", "disco", "r&b"], { osc: [{ w: "square" }], filter: LP(700, 4, 2, 0.15), amp: AMP(0.003, 0.25, 0.5, 0.1) }],
    ["Acid Bass", ["acid", "techno", "house"], { osc: [{ w: "sawtooth" }], filter: LP(350, 14, 3.5, 0.2, 0.2), drive: 0.3, amp: AMP(0.003, 0.3, 0.6, 0.08) }],
    ["Reese Bass", ["drum and bass", "dubstep", "garage"], { osc: [{ w: "sawtooth", uni: 2, spread: 30 }, { w: "sawtooth", det: -1200, g: 0.5 }], filter: LP(900, 1, 0, 0.2), lfo: { rate: 0.3, depth: 300 }, amp: AMP(0.01, 0.3, 1, 0.2) }],
    ["Wobble Bass", ["dubstep", "riddim"], { osc: [{ w: "sawtooth" }, { w: "square", g: 0.6 }], filter: LP(400, 8, 0, 0.2, 0.1), lfo: { rate: 3, depth: 1500 }, drive: 0.4, amp: AMP(0.01, 0.3, 1, 0.15) }],
    ["FM Bass", ["edm", "future bass", "pop"], { osc: [{ w: "sine" }], fm: { ratio: 1, index: 2.5, decay: 0.3, sus: 0.3 }, amp: AMP(0.003, 0.4, 0.7, 0.12), g: 0.5 }],
    ["Pluck Bass", ["house", "uk garage", "pop"], { osc: [{ w: "sawtooth" }], filter: LP(250, 6, 3.5, 0.12), amp: AMP(0.002, 0.3, 0, 0.1), sub: 0.4 }],
    ["Organ Bass", ["deep house", "garage", "90s house"], { osc: [{ w: "sine" }, { w: "sine", oct: 1, g: 0.6 }, { w: "sine", oct: 2, g: 0.25 }], amp: AMP(0.003, 0.2, 0.8, 0.08), g: 0.4 }],
    ["Growl Bass", ["dubstep", "bass music"], { osc: [{ w: "sawtooth" }], fm: { ratio: 0.5, index: 3, decay: 1, sus: 0.8 }, filter: LP(1200, 6, 0, 0.2, 0.1), lfo: { rate: 6, depth: 900 }, drive: 0.6, amp: AMP(0.01, 0.3, 1, 0.15), g: 0.3 }],
    ["Synthwave Bass", ["synthwave", "outrun", "80s"], { osc: [{ w: "sawtooth", uni: 2, spread: 12 }], filter: LP(450, 3, 2.5, 0.18), amp: AMP(0.002, 0.2, 0.4, 0.08), sub: 0.3 }],
    ["Moog-Style Bass", ["funk", "g-funk", "rock"], { osc: [{ w: "sawtooth" }, { w: "square", det: -1200, g: 0.6 }], filter: LP(600, 3, 2, 0.3), drive: 0.15, amp: AMP(0.003, 0.4, 0.7, 0.1) }],
    ["G-Funk Whine Bass", ["g-funk", "west coast", "hip hop"], { osc: [{ w: "sine" }, { w: "triangle", oct: 1, g: 0.3 }], vib: { rate: 5, depth: 10, delay: 0.25 }, amp: AMP(0.02, 0.3, 0.9, 0.2), g: 0.5 }],
  ].forEach(([n, t, P]) => addWithVariants(n, "Bass", "Synth bass", t, P, [24, 64]));

  // Leads
  [
    ["Saw Lead", ["edm", "pop", "trance"], { osc: [{ w: "sawtooth", uni: 3, spread: 18 }], filter: LP(3500, 1.5, 1, 0.3, 0.6), amp: AMP(0.005, 0.2, 0.85, 0.25), vib: { rate: 5.5, depth: 8, delay: 0.3 } }],
    ["Square Lead", ["chiptune", "synthwave", "pop"], { osc: [{ w: "square" }], filter: LP(3000, 1, 0.5, 0.2, 0.6), amp: AMP(0.005, 0.2, 0.8, 0.2), vib: { rate: 5.5, depth: 10, delay: 0.3 } }],
    ["Supersaw Lead", ["trance", "edm", "future bass"], { osc: [{ w: "sawtooth", uni: 7, spread: 40 }], filter: LP(5000, 0.8, 0.5, 0.3, 0.5), amp: AMP(0.01, 0.3, 0.9, 0.35), g: 0.3 }],
    ["Chip Lead", ["chiptune", "game", "8-bit"], { osc: [{ w: "pulse0.125" }], amp: AMP(0.002, 0.1, 0.8, 0.05), vib: { rate: 6, depth: 15, delay: 0.2 }, g: 0.25 }],
    ["Whistle Lead", ["g-funk", "west coast", "lo-fi"], { osc: [{ w: "sine" }], vib: { rate: 5.5, depth: 18, delay: 0.15 }, amp: AMP(0.03, 0.2, 0.9, 0.2), g: 0.4 }],
    ["Brass Stab", ["house", "funk", "80s"], { osc: [{ w: "sawtooth", uni: 3, spread: 14 }], filter: LP(900, 1.5, 2.5, 0.25, 0.5), amp: AMP(0.01, 0.3, 0.6, 0.15) }],
    ["Fifths Lead", ["techno", "edm", "rave"], { osc: [{ w: "sawtooth" }, { w: "sawtooth", det: 702, g: 0.7 }], filter: LP(2500, 2, 1.5, 0.25, 0.5), amp: AMP(0.003, 0.2, 0.7, 0.15) }],
    ["Hoover Lead", ["rave", "hardcore", "techno"], { osc: [{ w: "sawtooth", uni: 5, spread: 60 }, { w: "pulse0.3", det: -1200, g: 0.6 }], filter: LP(2200, 1, 1, 0.4, 0.4), amp: AMP(0.02, 0.3, 0.9, 0.3), glide: 0.25, g: 0.3 }],
    ["Soft Sine Lead", ["r&b", "neo soul", "chill"], { osc: [{ w: "sine" }, { w: "triangle", oct: 1, g: 0.15 }], amp: AMP(0.02, 0.2, 0.9, 0.3), vib: { rate: 5, depth: 8, delay: 0.4 }, g: 0.4 }],
    ["Synthwave Lead", ["synthwave", "80s", "outrun"], { osc: [{ w: "sawtooth", uni: 2, spread: 10 }, { w: "square", g: 0.4 }], filter: LP(2800, 2, 1, 0.3, 0.6), amp: AMP(0.01, 0.2, 0.85, 0.4), vib: { rate: 5, depth: 10, delay: 0.35 } }],
  ].forEach(([n, t, P]) => addWithVariants(n, "Synths", "Lead", t, P, [36, 96]));

  // Pads
  [
    ["Warm Pad", ["ambient", "r&b", "pop"], { osc: [{ w: "sawtooth", uni: 4, spread: 20 }], filter: LP(1200, 0.7, 0.5, 1.5, 0.4), amp: AMP(0.8, 1, 0.9, 1.5), g: 0.25 }],
    ["String Ensemble", ["orchestral", "disco", "80s"], { osc: [{ w: "sawtooth", uni: 5, spread: 25 }], filter: LP(2500, 0.7, 0, 0.5, 0.5), amp: AMP(0.4, 0.5, 0.9, 0.8), vib: { rate: 5, depth: 6, delay: 0.5 }, g: 0.22 }],
    ["Glass Pad", ["ambient", "chill", "cinematic"], { osc: [{ w: "sine" }], fm: { ratio: 3.5, index: 1, decay: 2, sus: 0.4 }, amp: AMP(0.5, 1, 0.8, 2), g: 0.3 }],
    ["Dark Pad", ["cinematic", "trap", "ambient"], { osc: [{ w: "sawtooth", uni: 3, spread: 15 }, { w: "triangle", det: -1200 }], filter: LP(500, 2, 0, 1, 0.3), lfo: { rate: 0.15, depth: 200 }, amp: AMP(1.2, 1, 0.9, 2), g: 0.28 }],
    ["Airy Pad", ["ambient", "lo-fi", "chill"], { osc: [{ w: "triangle", uni: 3, spread: 15 }], noise: 0.04, filter: LP(3000, 0.7, 0, 1, 0.4), amp: AMP(1, 1, 0.85, 2), g: 0.3 }],
    ["Synthwave Pad", ["synthwave", "80s", "retro"], { osc: [{ w: "sawtooth", uni: 4, spread: 18 }, { w: "pulse0.3", g: 0.4 }], filter: LP(1600, 1, 0.5, 1, 0.4), lfo: { rate: 0.4, depth: 300 }, amp: AMP(0.5, 1, 0.9, 1.2), g: 0.22 }],
    ["Lo-fi Keys Pad", ["lo-fi", "jazz hop", "chill"], { osc: [{ w: "triangle", uni: 2, spread: 14 }], filter: LP(900, 0.7, 0, 1, 0.3), vib: { rate: 0.8, depth: 12, delay: 0 }, amp: AMP(0.2, 1, 0.8, 1), g: 0.35 }],
    ["Choir Pad", ["gospel", "cinematic", "ambient"], { osc: [{ w: "sawtooth", uni: 3, spread: 16 }], formant: "a", voice: "high", vib: { rate: 5, depth: 10, delay: 0.3 }, amp: AMP(0.6, 1, 0.9, 1.2), g: 0.12 }],
    ["Swell Pad", ["edm", "cinematic", "build"], { osc: [{ w: "sawtooth", uni: 5, spread: 30 }], filter: LP(300, 1, 0, 1, 0.3), amp: AMP(2.5, 1, 1, 1.5), lfo: { rate: 0.12, w: "triangle", depth: 1500 }, g: 0.22 }],
  ].forEach(([n, t, P]) => addWithVariants(n, "Synths", "Pad", t, P, [24, 96]));

  // Plucks
  [
    ["Saw Pluck", ["edm", "house", "pop"], { osc: [{ w: "sawtooth", uni: 2, spread: 12 }], filter: LP(500, 2, 3.5, 0.18, 0.6), amp: AMP(0.002, 0.4, 0, 0.2) }],
    ["Future Bass Pluck", ["future bass", "edm", "pop"], { osc: [{ w: "sawtooth", uni: 6, spread: 35 }], filter: LP(700, 1, 3, 0.25, 0.5), amp: AMP(0.002, 0.5, 0, 0.25), g: 0.3 }],
    ["Tropical Pluck", ["tropical house", "dancehall", "pop"], { osc: [{ w: "sine" }, { w: "triangle", oct: 1, g: 0.3 }], amp: AMP(0.002, 0.35, 0, 0.15), g: 0.45 }],
    ["Square Pluck", ["chiptune", "synthwave", "game"], { osc: [{ w: "square" }], filter: LP(800, 3, 3, 0.15, 0.6), amp: AMP(0.002, 0.3, 0, 0.15) }],
    ["Bell Pluck", ["trap", "lo-fi", "pop"], { osc: [{ w: "sine" }], fm: { ratio: 3.01, index: 2, decay: 0.6, sus: 0.05 }, amp: AMP(0.002, 1.4, 0, 0.5), g: 0.35 }],
    ["Kalimba Synth", ["afrobeats", "lo-fi", "world"], { osc: [{ w: "sine" }], fm: { ratio: 5.4, index: 0.7, decay: 0.08, sus: 0 }, amp: AMP(0.002, 0.8, 0, 0.3), g: 0.45 }],
    ["Marimba Synth", ["afrobeats", "tropical", "pop"], { osc: [{ w: "sine" }], fm: { ratio: 4, index: 1, decay: 0.05, sus: 0 }, amp: AMP(0.002, 0.5, 0, 0.2), g: 0.5 }],
    ["Arp Pluck", ["trance", "techno", "synthwave"], { osc: [{ w: "sawtooth" }, { w: "square", det: 7, g: 0.6 }], filter: LP(900, 4, 2.5, 0.1, 0.6), amp: AMP(0.002, 0.2, 0, 0.1) }],
  ].forEach(([n, t, P]) => addWithVariants(n, "Synths", "Pluck", t, P, [36, 96]));

  // Keys and bells
  [
    ["Electric Piano", "Electric piano", ["neo soul", "r&b", "jazz", "lo-fi"], { osc: [{ w: "sine" }], fm: { ratio: 1, index: 1.4, decay: 0.6, sus: 0.15 }, amp: AMP(0.003, 2, 0.15, 0.4), g: 0.4 }],
    ["Tine Piano", "Electric piano", ["neo soul", "gospel", "chill"], { osc: [{ w: "sine" }, { w: "sine", oct: 3.8, g: 0.08 }], fm: { ratio: 14, index: 0.3, decay: 0.05, sus: 0 }, amp: AMP(0.002, 2.5, 0.1, 0.5), g: 0.4 }],
    ["Wurly Keys", "Electric piano", ["soul", "indie", "funk"], { osc: [{ w: "triangle" }], fm: { ratio: 1, index: 2.2, decay: 0.3, sus: 0.3 }, drive: 0.2, amp: AMP(0.003, 1.2, 0.2, 0.3), g: 0.35 }],
    ["DX Keys", "Electric piano", ["80s", "city pop", "ballad"], { osc: [{ w: "sine" }], fm: { ratio: 2, index: 1.8, decay: 0.8, sus: 0.2 }, amp: AMP(0.002, 2, 0.1, 0.5), g: 0.38 }],
    ["Drawbar Organ", "Organ", ["gospel", "rock", "blues"], { osc: [{ w: "sine" }, { w: "sine", oct: 1, g: 0.8 }, { w: "sine", oct: 1.585, g: 0.5 }, { w: "sine", oct: 2, g: 0.4 }], amp: AMP(0.005, 0.1, 1, 0.05), vib: { rate: 6.5, depth: 8, delay: 0 }, g: 0.22 }],
    ["Perc Organ", "Organ", ["jazz", "funk", "ska"], { osc: [{ w: "sine" }, { w: "sine", oct: 1, g: 0.6 }, { w: "sine", oct: 1.585, g: 0.5 }], fm: { ratio: 3, index: 0.5, decay: 0.15, sus: 0 }, amp: AMP(0.003, 0.1, 1, 0.05), g: 0.25 }],
    ["House Organ", "Organ", ["house", "90s house", "garage"], { osc: [{ w: "square" }, { w: "sine", oct: 1, g: 0.6 }], filter: LP(2000, 1, 1, 0.2, 0.5), amp: AMP(0.002, 0.3, 0.4, 0.1), g: 0.3 }],
    ["Clav Keys", "Clavinet", ["funk", "disco", "soul"], { osc: [{ w: "pulse0.2" }], filter: { type: "bandpass", f: 1500, q: 2, env: 1.5, d: 0.1, track: 0.6 }, amp: AMP(0.002, 0.4, 0, 0.08), g: 0.5 }],
    ["Toy Piano", "Toy piano", ["indie", "lo-fi", "kids"], { osc: [{ w: "sine" }], fm: { ratio: 6.2, index: 1.5, decay: 0.1, sus: 0 }, amp: AMP(0.002, 0.9, 0, 0.3), g: 0.4 }],
  ].forEach(([n, sub, t, P]) => addInst(n, "Keys", sub, t, P, [28, 103]));
  [
    ["FM Bell", ["trap", "christmas", "cinematic"], { osc: [{ w: "sine" }], fm: { ratio: 3.5, index: 3, decay: 1.5, sus: 0.1 }, amp: AMP(0.002, 3, 0, 1), g: 0.3 }],
    ["Tubular Synth Bell", ["cinematic", "church", "ambient"], { osc: [{ w: "sine" }], fm: { ratio: 2.76, index: 2, decay: 3, sus: 0.2 }, amp: AMP(0.002, 4, 0, 1.5), g: 0.3 }],
    ["Music Box", ["lo-fi", "horror", "lullaby"], { osc: [{ w: "sine" }, { w: "sine", oct: 2.33, g: 0.15 }], amp: AMP(0.001, 1.2, 0, 0.4), g: 0.4 }],
    ["Glass Mallet", ["ambient", "pop", "chill"], { osc: [{ w: "sine" }], fm: { ratio: 7, index: 0.8, decay: 0.3, sus: 0 }, amp: AMP(0.002, 1.5, 0, 0.5), g: 0.38 }],
  ].forEach(([n, t, P]) => addInst(n, "Synths", "Bells", t, P, [48, 108]));

  // Guitars (plucked string model)
  [
    ["Clean Electric Guitar", ["pop", "r&b", "indie", "funk"], { ks: { t60: 3, bright: 0.6 }, filter: LP(4500, 0.7, 0, 0.1, 0), amp: AMP(0.001, 3, 1, 0.15), g: 0.5 }],
    ["Nylon Guitar", ["latin", "bossa", "reggaeton", "lo-fi"], { ks: { t60: 2.5, bright: 0.35 }, filter: LP(3000, 0.7, 0, 0.1, 0), amp: AMP(0.001, 2.5, 1, 0.2), g: 0.5 }],
    ["Steel Acoustic Guitar", ["folk", "country", "pop"], { ks: { t60: 4, bright: 0.8 }, filter: LP(7000, 0.7, 0, 0.1, 0), amp: AMP(0.001, 4, 1, 0.2), g: 0.45 }],
    ["Muted Guitar", ["funk", "afrobeats", "reggae"], { ks: { t60: 0.25, bright: 0.5 }, filter: LP(2500, 0.7, 0, 0.1, 0), amp: AMP(0.001, 0.3, 1, 0.05), g: 0.6 }],
    ["Overdrive Guitar", ["rock", "blues", "indie"], { ks: { t60: 4, bright: 0.7 }, drive: 0.55, filter: LP(3500, 1, 0, 0.1, 0), amp: AMP(0.001, 4, 1, 0.15), g: 0.3 }],
    ["Distorted Power Guitar", ["rock", "metal", "punk"], { ks: { t60: 5, bright: 0.8 }, drive: 0.9, filter: LP(2800, 1.2, 0, 0.1, 0), amp: AMP(0.001, 5, 1, 0.1), g: 0.22 }],
    ["Jazz Guitar", ["jazz", "neo soul", "lo-fi"], { ks: { t60: 2.5, bright: 0.25 }, filter: LP(1800, 0.7, 0, 0.1, 0), amp: AMP(0.001, 2.5, 1, 0.2), g: 0.55 }],
    ["Highlife Guitar", ["afrobeats", "highlife", "soukous"], { ks: { t60: 1.2, bright: 0.75 }, filter: LP(5000, 0.7, 0, 0.1, 0), amp: AMP(0.001, 1.2, 1, 0.1), g: 0.5 }],
    ["Plucked Bass Guitar", ["funk", "rock", "pop"], { ks: { t60: 2.5, bright: 0.4 }, filter: LP(1200, 0.7, 0, 0.1, 0), amp: AMP(0.001, 2.5, 1, 0.1), g: 0.6 }],
  ].forEach(([n, t, P]) => addInst(n, n === "Plucked Bass Guitar" ? "Bass" : "Guitar and plucked", n === "Plucked Bass Guitar" ? "Electric bass" : "Electric and acoustic guitar", t, P, n === "Plucked Bass Guitar" ? [28, 60] : [40, 88]));

  // Vocal chops: sung vowels, high and low voice
  const VNAME = { a: "Ah", e: "Eh", i: "Ee", o: "Oh", u: "Oo" };
  for (const voice of ["high", "low"]) for (const v of "aeiou") {
    addInst(`Vocal Chop ${VNAME[v]} (${voice === "high" ? "high voice" : "low voice"})`, "Vocals", "Vowel chops", ["vocal chop", "pop", "edm", "future bass", "house"],
      { osc: [{ w: "sawtooth" }], noise: 0.03, formant: v, voice, vib: { rate: 5.5, depth: 14, delay: 0.12 }, amp: AMP(0.015, 0.3, 0.7, 0.12), g: 0.18 }, voice === "high" ? [55, 84] : [40, 67]);
  }
  for (const v of "aio") {
    addInst(`Breathy Chop ${VNAME[v]}`, "Vocals", "Vowel chops", ["vocal chop", "lo-fi", "r&b", "ambient"],
      { osc: [{ w: "triangle" }], noise: 0.12, formant: v, voice: "high", amp: AMP(0.04, 0.4, 0.5, 0.25), g: 0.25 }, [55, 84]);
  }

  pack.item_count = items.length;

  // ---------- players ----------
  function player(item, ctx) {
    if (item.kind === "kit") {
      const hits = item.make.hits;
      const find = (h) => (typeof h === "number" ? hits[h] : hits.find((x) => x.name.toLowerCase() === String(h).toLowerCase() || x.key === h)) || hits[0];
      return {
        item, kind: "kit", hits: hits.map((h, i) => ({ index: i, name: h.name, key: h.key })),
        ready() { S(ctx); return Promise.resolve(); },
        async play(h, vel, when, opt) { return playHit(ctx, find(h), vel == null ? 100 : vel, when, opt || {}); },
      };
    }
    return {
      item, kind: "instrument", range: [item.key_low, item.key_high],
      ready() { S(ctx); return Promise.resolve(); },
      async play(note, vel, when, opt) { return playNote(ctx, item.make, note, vel == null ? 100 : vel, when, opt || {}); },
    };
  }

  return { pack, items, player };
})();
