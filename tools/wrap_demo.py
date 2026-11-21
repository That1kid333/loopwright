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
  var sample = function (input, opts) { return arrange(input, opts).then(function (p) { return { text: JSON.stringify(p), truncated: false }; }); };
  sample.json = arrange;
  window.claude = { use: async function (name) {
    if (name === "sample") return sample;
    if (name !== "downloads") return null;
    return { save: async function (o) {
      var url = URL.createObjectURL(o.data), a = document.createElement("a");
      a.href = url; a.download = o.filename || "loopwright-track.zip"; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 4000);
    } };
  } };
})();
</script>"""
# The studio fills the window, so the host links sit inside its own top bar, not in a bar above it.
LOGO_OPEN = '<div class="logo">'
if mode == "web":
    frag = frag.replace(LOGO_OPEN, '<a class="logo" href="/" title="Back to the Loopwright site" style="color:inherit;text-decoration:none">', 1)
    frag = frag.replace('<b>Loopwright</b></div>', '<b>Loopwright</b></a>', 1)
    bar = """<div class="hostbar" style="display:flex;align-items:center;gap:10px;margin-left:auto;font-size:.78rem;color:var(--fg-2);white-space:nowrap">
<span class="hostnote" id="lwcred">Browser studio</span><a href="/signin/?next=/studio/" id="lwsign" style="color:var(--fg-1);text-decoration:none">Sign in</a><a href="/download/" class="hostnote" style="color:var(--accent);text-decoration:none;font-weight:600">Get the Mac app</a></div>"""
    # The free preset library: sounds made in code plus the recorded packs in Supabase storage.
    head_extra = '<link rel="icon" href="/assets/icon.svg" type="image/svg+xml"><script src="/assets/supabase.js"></script><script src="/assets/originals.js"></script><script src="/assets/library.js"></script>'
    tail = """<script>
(function(){var sign=document.getElementById("lwsign"),cred=document.getElementById("lwcred");
  async function paint(){var s=await window.lwSession();
    if(s){sign.textContent="Account";sign.href="/account/";
      try{var sb=window.__lwsb;var r=await sb.rpc("my_credit_balance");if(typeof r.data==="number"){cred.textContent=r.data+" credits";cred.classList.add("cr");}}catch(e){}}
    else{sign.textContent="Sign in";sign.href="/signin/?next=/studio/";cred.textContent="Browser studio";cred.classList.remove("cr");}}
  window.addEventListener("lw-credits",function(e){cred.textContent=e.detail+" credits";cred.classList.add("cr");});
  paint();})();
</script>"""
else:
    bar = """<div class="hostbar" id="lwbar" style="display:flex;align-items:center;gap:8px;margin-left:auto;font-size:.78rem;color:var(--fg-2);white-space:nowrap">
<span id="lwwho"></span><a href="https://loopwright-studio.netlify.app/account/" target="_blank" style="color:var(--accent);text-decoration:none">Account</a><a href="#" id="lwout" style="color:var(--accent);text-decoration:none">Sign out</a></div>"""
    head_extra = '<script src="supabase.js"></script><script src="auth.js"></script>'
    tail = """<script>
LWA.requireUser().then(function(u){ if(u) document.getElementById("lwwho").textContent = u.email; });
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
{bar}
{frag}
{tail}
</body></html>
"""
open(out, "w").write(page)
