/* Loopwright "My sounds": each signed-in user's own library.
 *
 * Files go to the private Storage bucket "user-sounds" under <user id>/, and one row per sound
 * goes in public.sounds. Row-level security means people only ever see their own sounds.
 *
 * Accepts audio (WAV, MP3, M4A/AAC, AIFF, OGG, FLAC, WebM) and video (MP4, MOV, WebM, MKV...).
 * For video, the browser pulls the sound track out and saves it as a WAV, so no video is stored.
 *
 * Needs window.LW.sb (site/assets/app.js).
 *
 *   const s = await MySounds.add(file, { name: "My vocal", tags: ["vocal"], rightsConfirmed: true });
 *   const list = await MySounds.list();
 *   const p = await MySounds.load(s.id, audioCtx); p.play(60, 100);   // 60 = original pitch
 *   await MySounds.rename(s.id, "Lead vocal"); await MySounds.remove(s.id);
 */
window.MySounds = (function () {
  const BUCKET = "user-sounds";
  const MAX_BYTES = 200 * 1024 * 1024;  // the bucket's own limit
  const KEEP_AS_IS = {                    // audio types the bucket stores without conversion
    "audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav", "audio/mpeg": "mp3", "audio/mp4": "m4a",
    "audio/x-m4a": "m4a", "audio/aac": "aac", "audio/aiff": "aiff", "audio/x-aiff": "aiff",
    "audio/ogg": "ogg", "audio/flac": "flac", "audio/x-flac": "flac", "audio/webm": "webm",
  };
  const EXT_TYPE = { wav: "audio/wav", mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", aif: "audio/aiff", aiff: "audio/aiff", ogg: "audio/ogg", oga: "audio/ogg", flac: "audio/flac" };
  const buffers = new Map();

  function sb() { if (!window.LW || !window.LW.sb) throw new Error("Loopwright isn't connected on this page."); return window.LW.sb; }
  async function uid() {
    const { data } = await sb().auth.getUser();
    if (!data || !data.user) throw new Error("Sign in to keep your own sounds.");
    return data.user.id;
  }
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const baseName = (f) => (f.name || "Sound").replace(/\.[^.]+$/, "").slice(0, 120);
  function typeOf(file) {
    if (file.type) return file.type;
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    return EXT_TYPE[ext] || (/(mp4|mov|m4v|mkv|avi|webm)$/.test(ext) ? "video/" + ext : "");
  }

  /** Decode any audio or video file to an AudioBuffer (44.1 kHz). */
  async function decode(file) {
    const bytes = await file.arrayBuffer();
    const ctx = new OfflineAudioContext(2, 1, 44100);
    try { return await ctx.decodeAudioData(bytes); }
    catch (e) { throw new Error("Couldn't find a sound in " + (file.name || "that file") + ". Try WAV, MP3 or MP4."); }
  }

  /** 16-bit PCM WAV from an AudioBuffer, optionally trimmed (seconds). */
  function toWav(buf, start, end) {
    const sr = buf.sampleRate, ch = Math.min(2, buf.numberOfChannels);
    const a = Math.max(0, Math.floor((start || 0) * sr)), b = Math.min(buf.length, end ? Math.floor(end * sr) : buf.length);
    const n = Math.max(0, b - a), data = new DataView(new ArrayBuffer(44 + n * ch * 2));
    const str = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
    str(0, "RIFF"); data.setUint32(4, 36 + n * ch * 2, true); str(8, "WAVE"); str(12, "fmt ");
    data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true); data.setUint32(24, sr, true);
    data.setUint32(28, sr * ch * 2, true); data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true); str(36, "data"); data.setUint32(40, n * ch * 2, true);
    const chans = []; for (let c = 0; c < ch; c++) chans.push(buf.getChannelData(c));
    let o = 44;
    for (let i = a; i < b; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, chans[c][i])); data.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
    return new Blob([data], { type: "audio/wav" });
  }

  /**
   * Add a file to the user's library. Options: name, tags, kind ("sample" | "loop" | "recording"),
   * bpm, key, rightsConfirmed (they made it or have the rights), trim {start, end} in seconds,
   * onProgress(stage) with "reading" | "converting" | "uploading" | "saving".
   */
  async function add(file, opt) {
    opt = opt || {};
    const user = await uid(), step = opt.onProgress || (() => {});
    step("reading");
    const type = typeOf(file), buf = await decode(file);
    let blob = file, ext = KEEP_AS_IS[type];
    if (!ext || opt.trim) { step("converting"); blob = toWav(buf, opt.trim && opt.trim.start, opt.trim && opt.trim.end); ext = "wav"; }
    if (blob.size > MAX_BYTES) throw new Error("That sound is over 200 MB. Trim it and try again.");
    const path = user + "/" + uuid() + "." + ext;
    step("uploading");
    const up = await sb().storage.from(BUCKET).upload(path, blob, { contentType: blob.type || type, upsert: false });
    if (up.error) throw new Error("Upload failed: " + up.error.message);
    step("saving");
    const dur = opt.trim ? Math.max(0, (opt.trim.end || buf.duration) - (opt.trim.start || 0)) : buf.duration;
    const row = {
      name: (opt.name || baseName(file)).slice(0, 120), storage_path: path, kind: opt.kind || (type.startsWith("video/") ? "recording" : "sample"),
      duration_seconds: Math.round(dur * 1000) / 1000, sample_rate: buf.sampleRate, channels: Math.min(2, buf.numberOfChannels),
      bpm: opt.bpm || null, musical_key: opt.key || null,
      tags: (opt.tags || []).concat(type.startsWith("video/") ? ["from video"] : []), rights_confirmed: !!opt.rightsConfirmed,
    };
    const ins = await sb().from("sounds").insert(row).select().single();
    if (ins.error) { await sb().storage.from(BUCKET).remove([path]); throw new Error("Couldn't save the sound: " + ins.error.message); }
    buffers.set(ins.data.id, Promise.resolve(buf));
    return ins.data;
  }

  /** The user's sounds, newest first. Options: search (name or tag), kind, limit. */
  async function list(opt) {
    opt = opt || {};
    await uid();
    let q = sb().from("sounds").select("*").order("created_at", { ascending: false }).limit(opt.limit || 500);
    if (opt.kind) q = q.eq("kind", opt.kind);
    if (opt.search) {
      const s = opt.search.replace(/[%,(){}"*]/g, " ").trim();
      if (s) q = /\s/.test(s) ? q.ilike("name", `%${s}%`) : q.or(`name.ilike.%${s}%,tags.cs.{${s.toLowerCase()}}`);
    }
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data;
  }

  async function row(id) {
    const { data, error } = await sb().from("sounds").select("*").eq("id", id).single();
    if (error) throw new Error("No such sound.");
    return data;
  }

  /** Decoded AudioBuffer for one of the user's sounds. */
  function buffer(id) {
    if (!buffers.has(id)) {
      const p = (async () => {
        const r = await row(id);
        const s = await sb().storage.from(BUCKET).createSignedUrl(r.storage_path, 600);
        if (s.error) throw new Error(s.error.message);
        const res = await fetch(s.data.signedUrl);
        if (!res.ok) throw new Error("Couldn't download the sound.");
        return new OfflineAudioContext(2, 1, 44100).decodeAudioData(await res.arrayBuffer());
      })();
      p.catch(() => buffers.delete(id));
      buffers.set(id, p);
    }
    return buffers.get(id);
  }

  /** A player with the same shape as the preset library's instruments. Note 60 plays at original pitch. */
  async function load(id, ctx) {
    const buf = await buffer(id), r = await row(id);
    return {
      item: { id, name: r.name, kind: "instrument", category: "My sounds", tags: r.tags, key_low: 0, key_high: 127 },
      kind: "instrument", range: [0, 127], buffer: buf,
      ready() { return Promise.resolve(); },
      async play(note, vel, when, opt) {
        opt = opt || {}; vel = vel == null ? 100 : vel;
        const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = Math.pow(2, ((note == null ? 60 : note) - 60) / 12);
        const g = ctx.createGain(); g.gain.value = Math.pow(vel / 127, 1.6) * 0.9 + 0.1; g.gain.value *= opt.gain == null ? 1 : opt.gain;
        src.connect(g).connect(opt.destination || ctx.destination);
        const at = Math.max(when || 0, ctx.currentTime); src.start(at, opt.offset || 0);
        const stop = (t) => { const s = t || ctx.currentTime; g.gain.cancelScheduledValues(s); g.gain.setValueAtTime(g.gain.value, s); g.gain.linearRampToValueAtTime(0.0001, s + 0.05); src.stop(s + 0.06); };
        if (opt.duration) stop(at + opt.duration);
        return { stop };
      },
    };
  }

  async function update(id, fields) {
    const allowed = {}; for (const k of ["name", "tags", "kind", "bpm", "musical_key", "rights_confirmed"]) if (k in fields) allowed[k] = fields[k];
    const { data, error } = await sb().from("sounds").update(allowed).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return data;
  }
  const rename = (id, name) => update(id, { name: String(name).slice(0, 120) });

  async function remove(id) {
    const r = await row(id);
    const del = await sb().storage.from(BUCKET).remove([r.storage_path]);
    if (del.error) throw new Error(del.error.message);
    const { error } = await sb().from("sounds").delete().eq("id", id);
    if (error) throw new Error(error.message);
    buffers.delete(id);
  }

  /** Total size the user has stored, in bytes (for showing space used). */
  async function usage() {
    const user = await uid();
    let total = 0, offset = 0;
    for (;;) {
      const { data, error } = await sb().storage.from(BUCKET).list(user, { limit: 1000, offset });
      if (error) throw new Error(error.message);
      for (const o of data) total += (o.metadata && o.metadata.size) || 0;
      if (data.length < 1000) break; offset += 1000;
    }
    return total;
  }

  /** File types the picker should accept. */
  const accept = "audio/*,video/*,.wav,.mp3,.m4a,.aac,.aif,.aiff,.ogg,.flac,.mp4,.mov,.m4v,.webm,.mkv";

  return { add, list, load, buffer, update, rename, remove, usage, decode, toWav, accept };
})();
