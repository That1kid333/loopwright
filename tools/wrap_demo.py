"""Wrap the demo fragment into a standalone page. mode: web | desktop"""
import sys, re
src, out, mode = sys.argv[1], sys.argv[2], sys.argv[3]
frag = open(src).read()
frag = frag.replace('"Claude isn\'t available in this view, so a keyword matcher arranges it."',
                    '"AI arranging opens soon. For now a built-in keyword matcher arranges your sounds."')
frag = frag.replace("Open the page in claude.ai to export.", "Try exporting again.")
frag = re.sub(r'<meta name="claude:[^>]*>\n?', '', frag)
shim = """<script>
/* Stand-alone shim: no Claude runtime here. Export saves through a normal download. */
window.claude = { use: async function (name) {
  if (name !== "downloads") return null;
  return { save: async function (o) {
    var url = URL.createObjectURL(o.data), a = document.createElement("a");
    a.href = url; a.download = o.filename || "loopwright-track.zip"; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 4000);
  } };
} };
</script>"""
# The studio fills the window, so the host links sit inside its own top bar, not in a bar above it.
LOGO_OPEN = '<div class="logo">'
if mode == "web":
    frag = frag.replace(LOGO_OPEN, '<a class="logo" href="/" title="Back to the Loopwright site" style="color:inherit;text-decoration:none">', 1)
    frag = frag.replace('<b>Loopwright</b></div>', '<b>Loopwright</b></a>', 1)
    bar = """<div class="hostbar" style="display:flex;align-items:center;gap:10px;margin-left:auto;font-size:.78rem;color:var(--fg-2);white-space:nowrap">
<span class="hostnote">Browser studio</span><a href="/download/" style="color:var(--accent);text-decoration:none;font-weight:600">Get the Mac app</a></div>"""
    head_extra = '<link rel="icon" href="/assets/icon.svg" type="image/svg+xml">'
    tail = ""
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
hide = "<style>@media (max-width:760px){.hostbar .hostnote,#lwwho{display:none}}</style>"
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
