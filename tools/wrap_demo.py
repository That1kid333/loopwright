"""Wrap the demo fragment into a standalone page. mode: web | desktop"""
import sys, re
src, out, mode = sys.argv[1], sys.argv[2], sys.argv[3]
frag = open(src).read()
frag = frag.replace('"Claude isn\'t available in this view, so a keyword matcher arranges it."',
                    '"The AI producer is not switched on here yet. A keyword matcher stands in: name a style (lo-fi, trap, house, ambient), a tempo, or words like dark, dreamy, chop or reverse."')
frag = frag.replace("Open the page in claude.ai to export.", "Try exporting again.")
frag = re.sub(r'<meta name="claude:[^>]*>\n?', '', frag)
shim = """<script>
/* Stand-alone shim: export saves through a normal download, and the AI producer
   calls Loopwright's own "arrange" server function with the signed-in user's session. */
window.LW_LIVE = true;
window.LW_DEMO = __DEMO__;
(function () {
  var FN = "https://vvllgdrpnieorcpweurz.supabase.co/functions/v1/arrange";
  var KEY = "sb_publishable_6iCD4SBhUOXgOoyyIT3qZA__dTbzZZF";
  function sbClient() {
    if (window.LWA && window.LWA.sb) return window.LWA.sb;
    if (!window.__lwsb && window.supabase) window.__lwsb = window.supabase.createClient("https://vvllgdrpnieorcpweurz.supabase.co", KEY,
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
    return window.__lwsb || null;
  }
  window.lwSession = async function () { var sb = sbClient(); if (!sb) return null; var r = await sb.auth.getSession(); return r.data.session; };
  function fail(code, msg) { var e = new Error(msg || code); e.code = code; return e; }
  async function arrange(prompt, opts) {
    opts = opts || {};
    var s = await window.lwSession();
    if (!s) throw fail("sign_in");
    var mode = "standard"; try { if (typeof settings !== "undefined" && settings.mode) mode = settings.mode; } catch (e) {}
    var res;
    try {
      res = await fetch(FN, { method: "POST", signal: opts.signal,
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + s.access_token, "apikey": KEY },
        body: JSON.stringify({ prompt: typeof prompt === "string" ? prompt : JSON.stringify(prompt), mode: mode }) });
    } catch (e) { if (e && e.name === "AbortError") throw fail("cancelled"); throw fail("network"); }
    var data = {}; try { data = await res.json(); } catch (e) {}
    if (!res.ok || !data.plan) throw fail(data.error || "server", data.message);
    if (typeof data.balance === "number") window.dispatchEvent(new CustomEvent("lw-credits", { detail: data.balance }));
    return data.plan;
  }
  /* Make a sound: the "make-sound" server function turns a description into synth recipes (the app renders them). */
  window.lwMakeSound = async function (description, opts) {
    opts = opts || {};
    var s = await window.lwSession();
    if (!s) throw fail("sign_in");
    var res;
    try {
      res = await fetch(FN.replace(/arrange$/, "make-sound"), { method: "POST", signal: opts.signal,
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + s.access_token, "apikey": KEY },
        body: JSON.stringify({ description: description, count: opts.count || 2, mode: opts.mode || "standard", kind: opts.kind }) });
    } catch (e) { if (e && e.name === "AbortError") throw fail("cancelled"); throw fail("network"); }
    var data = {}; try { data = await res.json(); } catch (e) {}
    if (!res.ok || !data.sounds || !data.sounds.length) throw fail(data.error || "server", data.message);
    if (typeof data.balance === "number") window.dispatchEvent(new CustomEvent("lw-credits", { detail: data.balance }));
    return data;
  };
  var sample = function (input, opts) { return arrange(input, opts).then(function (p) { return { text: JSON.stringify(p), truncated: false }; }); };
  sample.json = arrange;
  /* Keep the song and the studio's settings in the user's account, so a browser that forgets
     (cleared data, another computer) gets them back. The browser copy stays as a fast cache. */
  var PREF_KEYS = ["loopwright-settings", "loopwright-layout", "loopwright-layout-mine", "loopwright-ai", "loopwright-ai-memory"];
  var LS = null; try { LS = window.localStorage; } catch (e) {}
  var origSet = Storage.prototype.setItem;
  function lsGet(k) { try { return LS ? LS.getItem(k) : null; } catch (e) { return null; } }
  function lsSet(k, v) { try { if (LS) origSet.call(LS, k, v); } catch (e) {} }
  var C = { uid: null, sb: null, started: false, projId: null, last: "", dirty: false, busy: false, prefTimer: 0 };
  function status(text, bad) { var el = document.getElementById("lwsave"); if (el) { el.textContent = text; el.style.color = bad ? "var(--led, #ffb020)" : ""; } }
  Storage.prototype.setItem = function (k, v) {
    origSet.call(this, k, v);
    if (this === LS && PREF_KEYS.indexOf(k) >= 0) { origSet.call(this, "loopwright-prefs-t", String(Date.now())); if (C.uid) { clearTimeout(C.prefTimer); C.prefTimer = setTimeout(pushPrefs, 1500); } }
  };
  function collectPrefs() { var o = {}; PREF_KEYS.forEach(function (k) { var v = lsGet(k); if (v != null) { try { o[k] = JSON.parse(v); } catch (e) {} } }); return o; }
  async function pushPrefs() {
    if (!C.uid) return;
    var t = Number(lsGet("loopwright-prefs-t")) || Date.now();
    var r = await C.sb.from("user_settings").upsert({ user_id: C.uid, studio_prefs: collectPrefs(), studio_prefs_at: new Date(t).toISOString() }, { onConflict: "user_id" });
    if (r.error) status("Settings not saved to your account", true);
  }
  async function pullPrefs() {
    var r = await C.sb.from("user_settings").select("studio_prefs,studio_prefs_at").eq("user_id", C.uid).maybeSingle();
    if (r.error) return false;
    var row = r.data, prefs = (row && row.studio_prefs) || {};
    var localT = Number(lsGet("loopwright-prefs-t")) || 0, dbT = row && row.studio_prefs_at ? Date.parse(row.studio_prefs_at) : 0;
    if (dbT > localT && Object.keys(prefs).length) {
      var changed = false;
      PREF_KEYS.forEach(function (k) { if (k in prefs) { var v = JSON.stringify(prefs[k]); if (lsGet(k) !== v) { lsSet(k, v); changed = true; } } });
      lsSet("loopwright-prefs-t", String(dbT));
      return changed;
    }
    if (localT > dbT && Object.keys(collectPrefs()).length) pushPrefs();
    return false;
  }
  function songNow() { try { return JSON.stringify(window.__lw.song.get()); } catch (e) { return ""; } }
  async function pushSong() {
    if (!C.uid || C.busy || !C.last) return;
    C.busy = true; C.dirty = false; status("Saving…");
    var sg = JSON.parse(C.last), row = { arrangement: sg, bpm: sg.bpm, swing: Math.min(0.3, Math.max(0, Number(sg.swing) || 0)), length_bars: 8, updated_at: new Date().toISOString() }, r;
    try {
      if (C.projId) r = await C.sb.from("projects").update(row).eq("id", C.projId).select("id");
      if (!C.projId || (r && !r.error && !(r.data && r.data.length))) { row.title = "My song"; r = await C.sb.from("projects").insert(row).select("id"); if (r.data && r.data[0]) C.projId = r.data[0].id; }
    } catch (e) { r = { error: e }; }
    C.busy = false;
    if (r && r.error) { C.dirty = true; status("Not saved yet. Retrying", true); } else status("Saved to your account");
  }
  function tick() {
    var s = songNow();
    if (s && s !== C.last) { C.last = s; C.dirty = true; lsSet("loopwright-song", JSON.stringify({ uid: C.uid, t: Date.now(), song: JSON.parse(s) })); }
    if (C.dirty) pushSong();
  }
  async function pullSong() {
    var local = null; try { local = JSON.parse(lsGet("loopwright-song") || "null"); } catch (e) {}
    if (local && local.uid !== C.uid) local = null;
    var r = await C.sb.from("projects").select("id,arrangement,updated_at").eq("owner_id", C.uid).order("updated_at", { ascending: false }).limit(1);
    var row = r.data && r.data[0]; if (row) C.projId = row.id;
    var dbT = row ? Date.parse(row.updated_at) : 0, lT = (local && local.t) || 0, pick = null;
    if (row && row.arrangement && Array.isArray(row.arrangement.tracks) && dbT >= lT) pick = row.arrangement;
    else if (local && local.song) pick = local.song;
    if (pick) {
      var res = await window.__lw.song.set(pick);
      if (res && res.dropped) status(res.dropped + (res.dropped === 1 ? " track" : " tracks") + " used a sound that couldn't be loaded", true);
      else status(res && res.ok ? "Your saved song is back" : "Couldn't open your saved song", !(res && res.ok));
    }
    C.last = songNow();
    if ((pick && lT > dbT) || !row) { C.dirty = true; pushSong(); }
    else if (!pick) status("Saved to your account");
  }
  async function cloudStart() {
    if (C.started || !window.__lw || !window.__lw.song) return;
    var s = await window.lwSession(); if (!s || C.started) return;
    C.started = true; C.sb = sbClient(); C.uid = s.user.id;
    try {
      if (await pullPrefs()) {
        var once = null; try { once = sessionStorage.getItem("lw-prefs-applied"); } catch (e) {}
        if (!once) { try { sessionStorage.setItem("lw-prefs-applied", "1"); } catch (e) {} location.reload(); return; }
      }
    } catch (e) {}
    try { await pullSong(); } catch (e) { C.last = songNow(); }
    setInterval(tick, 3000);
    document.addEventListener("visibilitychange", function () { if (document.hidden) tick(); });
  }
  window.LWCloud = { start: cloudStart, saveNow: tick };
  window.addEventListener("lw-ready", function () { cloudStart(); });
  window.claude = { use: async function (name) {
    if (name === "sample") return window.LW_DEMO ? null : sample;
    if (name !== "downloads") return null;
    return { save: async function (o) {
      var url = URL.createObjectURL(o.data), a = document.createElement("a");
      a.href = url; a.download = o.filename || "loopwright-track.zip"; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 4000);
    } };
  } };
})();
</script>"""
shim = shim.replace("__DEMO__", "true" if mode == "web" else "false")
if mode == "web":
    MAC = '<a href="/download/" style="color:var(--accent)">Get the Mac app</a>'
    for a, b in [
        ('"The AI producer is not switched on here yet. A keyword matcher stands in: name a style (lo-fi, trap, house, ambient), a tempo, or words like dark, dreamy, chop or reverse."',
         '"This is the browser demo, so a free word matcher arranges it. Name a style (lo-fi, trap, house, ambient), a tempo, or words like dark, dreamy, chop or reverse. The AI producer is in the Mac app."'),
        ('The AI producer isn\'t switched on in this version yet, so a simple keyword matcher made this from the words you typed.',
         'This is the browser demo, so a free word matcher made this from your words. The AI producer, which writes a full arrangement from your sounds, is in the Mac app. ' + MAC),
        ('"Lyric ideas need Claude, which isn\'t available in this view."', '"Lyric ideas come with the AI producer in the Mac app."'),
        ('". Charged from your credits."', '". Used by the AI producer in the Mac app."'),
        ('"Arrange" asks Claude for a pattern built only from your listed sounds when this view allows it. Otherwise a keyword matcher does it.',
         '"Arrange" uses a free word matcher in the browser demo. The AI producer in the Mac app writes the full arrangement from your sounds.'),
        ('<div class="aipop-head"><span class="label">AI producer</span>', '<div class="aipop-head"><span class="label">Word matcher</span>'),
        ('`Undo AI change (${snaps.length})`:"Undo AI change"', '`Undo (${snaps.length})`:"Undo"'),
    ]:
        assert frag.count(a) >= 1, a[:60]
        frag = frag.replace(a, b)
# The studio fills the window, so the host links sit inside its own top bar, not in a bar above it.
LOGO_OPEN = '<div class="logo">'
if mode == "web":
    frag = frag.replace(LOGO_OPEN, '<a class="logo" href="/" title="Back to the Loopwright site" style="color:inherit;text-decoration:none">', 1)
    frag = frag.replace('<b>Loopwright</b></div>', '<b>Loopwright</b></a>', 1)
    bar = """<div class="hostbar" style="display:flex;align-items:center;gap:10px;margin-left:auto;font-size:.78rem;color:var(--fg-2);white-space:nowrap">
<span class="hostnote" id="lwsave"></span><span class="hostnote" title="The AI producer is in the Mac app">Browser demo</span><a href="/signin/?next=/studio/" id="lwsign" style="color:var(--fg-1);text-decoration:none">Sign in</a><a href="/download/" class="hostnote" style="color:var(--accent);text-decoration:none;font-weight:600">Get the Mac app</a></div>"""
    # The free preset library: sounds made in code plus the recorded packs in Supabase storage.
    head_extra = '<link rel="icon" href="/assets/icon.svg" type="image/svg+xml"><script src="/assets/supabase.js"></script><script src="/assets/originals.js"></script><script src="/assets/library.js"></script><script src="/assets/my-sounds.js"></script><script src="/assets/sound-maker.js"></script>'
    gate = """<div id="lwgate" role="dialog" aria-modal="true" aria-labelledby="lwgateh" style="position:fixed;inset:0;z-index:9999;background:#07090c;color:#e9edf2;display:grid;place-items:center;padding:24px;font-family:Inter,system-ui,-apple-system,'Segoe UI',sans-serif">
<div style="max-width:400px;text-align:center"><img src="/assets/icon.svg" alt="" width="48" height="48" style="margin-bottom:14px">
<h1 id="lwgateh" style="font:600 1.5rem/1.25 'Space Grotesk',Inter,sans-serif;margin:0 0 10px">Sign in to try the studio</h1>
<p id="lwgatep" style="color:#8e98a5;margin:0 0 22px;line-height:1.5">Checking your account…</p>
<div id="lwgateb" hidden style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
<a href="/signin/?next=/studio/" style="background:#3fd0bf;color:#03201c;font-weight:600;padding:12px 20px;border-radius:10px;text-decoration:none;min-width:140px">Sign in</a>
<a href="/signin/?mode=signup&amp;next=/studio/" style="border:1px solid #2a323d;color:#e9edf2;padding:12px 20px;border-radius:10px;text-decoration:none;min-width:140px">Create an account</a></div>
<p style="margin:22px 0 0"><a href="/" style="color:#8e98a5;font-size:.85rem">Back to the Loopwright site</a></p></div></div>"""
    tail = """<script>
(function(){var sign=document.getElementById("lwsign");
  function out(){var p=document.getElementById("lwgatep"),b=document.getElementById("lwgateb");
    p.textContent="The studio is for Loopwright members. Making an account is free, and your songs and settings are saved to it.";b.hidden=false;b.style.display="flex";}
  async function check(){var s=null;try{s=await window.lwSession();}catch(e){}
    if(!s){out();sign.textContent="Sign in";sign.href="/signin/?next=/studio/";return;}
    var g=document.getElementById("lwgate");if(g)g.remove();sign.textContent="Account";sign.href="/account/";
    if(window.LWCloud)window.LWCloud.start();}
  check();})();
</script>"""
else:
    gate = ""
    bar = """<div class="hostbar" id="lwbar" style="display:flex;align-items:center;gap:8px;margin-left:auto;font-size:.78rem;color:var(--fg-2);white-space:nowrap">
<span id="lwsave" class="hostnote"></span><span id="lwwho"></span><a href="https://loopwright-studio.netlify.app/account/" target="_blank" style="color:var(--accent);text-decoration:none">Account</a><a href="#" id="lwout" style="color:var(--accent);text-decoration:none">Sign out</a></div>"""
    # Same free library and online My sounds as the website (copies of site/assets/*.js in desktop/src).
    head_extra = '<script src="diag.js"></script><script src="supabase.js"></script><script src="auth.js"></script><script src="originals.js"></script><script src="library.js"></script><script src="my-sounds.js"></script><script src="sound-maker.js"></script>'
    tail = """<script>
LWA.requireUser().then(function(u){ if(u) { document.getElementById("lwwho").textContent = u.email; if (window.LWCloud) window.LWCloud.start(); } });
document.getElementById("lwout").onclick = function(e){ e.preventDefault(); LWA.signOut(); };
</script>"""
assert frag.count("</header>") == 1, "studio top bar not found"
frag = frag.replace("</header>", bar + "\n</header>", 1)
bar = ""
hide = "<style>@media (max-width:760px){.hostbar .hostnote:not(.cr),#lwwho{display:none}}</style>"
head_extra += hide
page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
{head_extra}
{shim}
</head><body>
{gate}
{bar}
{frag}
{tail}
</body></html>
"""
open(out, "w").write(page)
