/* If something goes wrong in a page, say so on screen instead of leaving a window that looks frozen.
   Errors also go to the log file (Help > Open log file). The banner never covers the page. */
(function () {
  var shown = false;
  function banner(title, detail) {
    if (shown) return; shown = true;
    function put() {
      var b = document.createElement("div");
      b.setAttribute("role", "alert");
      b.style.cssText = "position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483647;display:flex;gap:12px;align-items:center;flex-wrap:wrap;" +
        "padding:12px 14px;border-radius:12px;background:#2a1712;border:1px solid #7a3b2a;color:#ffd9cc;font:14px/1.4 Inter,system-ui,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.5)";
      var t = document.createElement("div"); t.style.cssText = "flex:1;min-width:220px";
      var h = document.createElement("b"); h.textContent = title; t.appendChild(h);
      if (detail) { var d = document.createElement("div"); d.style.cssText = "opacity:.8;font-size:12px;margin-top:2px;word-break:break-word"; d.textContent = detail; t.appendChild(d); }
      function btn(label, fn) { var x = document.createElement("button"); x.type = "button"; x.textContent = label; x.onclick = fn;
        x.style.cssText = "font:600 13px Inter,system-ui,sans-serif;padding:8px 12px;border-radius:8px;border:1px solid #ffb39c;background:transparent;color:#ffd9cc;cursor:pointer"; return x; }
      b.appendChild(t);
      b.appendChild(btn("Reload", function () { location.reload(); }));
      b.appendChild(btn("Copy details", function () { try { navigator.clipboard.writeText(title + "\n" + (detail || "") + "\n" + navigator.userAgent); } catch (e) {} }));
      b.appendChild(btn("Dismiss", function () { b.remove(); }));
      document.body.appendChild(b);
    }
    if (document.body) put(); else document.addEventListener("DOMContentLoaded", put);
  }
  window.addEventListener("error", function (e) {
    if (e && e.target && e.target !== window && (e.target.src || e.target.href)) {   // a script or file failed to load
      banner("Part of Loopwright didn't load.", String(e.target.src || e.target.href).replace(location.origin, ""));
      return;
    }
    var where = e.filename ? String(e.filename).replace(location.origin, "") + ":" + e.lineno : "";
    banner("Something went wrong in Loopwright.", (e.message || "Unknown error") + (where ? " (" + where + ")" : ""));
  }, true);
  window.addEventListener("unhandledrejection", function (e) {
    var r = e && e.reason; console.error("Unhandled:", r && (r.stack || r.message) || r);
  });
  // The studio announces "lw-ready" when it has finished starting. If it never does, say so.
  if (/studio\.html$/.test(location.pathname)) {
    var ready = false;
    window.addEventListener("lw-ready", function () { ready = true; });
    setTimeout(function () { if (!ready) { console.error("Studio did not finish starting"); banner("The studio didn't finish starting.", "Try Reload. If it happens again, use Help > Open log file."); } }, 20000);
  }
  window.LWDiag = { banner: banner };
})();
