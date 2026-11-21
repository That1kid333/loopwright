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
if mode == "web":
    bar = """<div style="position:sticky;top:0;z-index:50;display:flex;gap:12px;align-items:center;justify-content:space-between;padding:10px 16px;margin:0 -16px 12px;background:#0b0d10ee;border-bottom:1px solid #272d36;font:14px Inter,system-ui,sans-serif;backdrop-filter:blur(8px)">
<a href="/" style="color:#e9edf2;text-decoration:none;font-weight:700;font-family:'Space Grotesk',Inter,sans-serif">&larr; Loopwright</a>
<span style="color:#8e98a5">Browser preview. <a href="/download/" style="color:#3fd0bf">Get the desktop app</a></span></div>"""
    head_extra = '<link rel="icon" href="/assets/icon.svg" type="image/svg+xml">'
    tail = ""
else:
    bar = """<div id="lwbar" style="position:sticky;top:0;z-index:50;display:flex;gap:12px;align-items:center;justify-content:space-between;padding:8px 16px;margin:0 -16px 12px;background:#0b0d10ee;border-bottom:1px solid #272d36;font:13px Inter,system-ui,sans-serif">
<b style="font-family:'Space Grotesk',Inter,sans-serif;color:#e9edf2">Loopwright</b>
<span style="color:#8e98a5"><span id="lwwho"></span> · <a href="https://loopwright-studio.netlify.app/account/" target="_blank" style="color:#3fd0bf">Account</a> · <a href="#" id="lwout" style="color:#3fd0bf">Sign out</a></span></div>"""
    head_extra = '<script src="supabase.js"></script><script src="auth.js"></script>'
    tail = """<script>
LWA.requireUser().then(function(u){ if(u) document.getElementById("lwwho").textContent = u.email; });
document.getElementById("lwout").onclick = function(e){ e.preventDefault(); LWA.signOut(); };
</script>"""
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
