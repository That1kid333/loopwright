/* Loopwright site motion: reveals, micro-interactions and the hero studio console.
   Plain JS, no libraries. Everything respects prefers-reduced-motion. */
(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  root.classList.add("motion-ready");

  function ready(fn) { if (document.readyState !== "loading") fn(); else document.addEventListener("DOMContentLoaded", fn); }

  ready(function () {
    /* ---- header shadow + scroll progress ---- */
    var header = document.querySelector("header.site");
    var bar = document.createElement("div"); bar.className = "progress"; bar.setAttribute("aria-hidden", "true");
    document.body.appendChild(bar);
    var ticking = false;
    function onScroll() {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () {
        var y = window.scrollY || 0, h = document.documentElement.scrollHeight - innerHeight;
        if (header) header.classList.toggle("scrolled", y > 8);
        bar.style.setProperty("--p", h > 0 ? Math.min(1, y / h).toFixed(4) : 0);
        ticking = false;
      });
    }
    addEventListener("scroll", onScroll, { passive: true }); onScroll();

    /* ---- staggered reveals ---- */
    document.querySelectorAll("[data-stagger]").forEach(function (box) {
      var kids = box.querySelectorAll(":scope > [data-reveal]");
      kids.forEach(function (k, i) { k.style.setProperty("--i", i); });
    });
    var revealables = document.querySelectorAll("[data-reveal], .viz, .meterbar, [data-count]");
    if (reduce || !("IntersectionObserver" in window)) {
      revealables.forEach(function (el) { el.classList.add("is-in"); if (el.dataset.count) setCount(el, 1); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.target.classList.contains("viz")) { e.target.classList.toggle("is-in", e.isIntersecting); return; }
          if (!e.isIntersecting) return;
          e.target.classList.add("is-in");
          if (e.target.dataset.count) countUp(e.target);
          io.unobserve(e.target);
        });
      }, { threshold: 0.15, rootMargin: "0px 0px -6% 0px" });
      revealables.forEach(function (el) { io.observe(el); });
    }

    /* ---- count-up numbers ---- */
    function setCount(el, t) {
      var to = parseFloat(el.dataset.count), pre = el.dataset.prefix || "", suf = el.dataset.suffix || "";
      el.textContent = pre + Math.round(to * t).toLocaleString() + suf;
    }
    function countUp(el) {
      var start = performance.now(), dur = 1200;
      (function step(now) {
        var t = Math.min(1, (now - start) / dur); t = 1 - Math.pow(1 - t, 3);
        setCount(el, t); if (t < 1) requestAnimationFrame(step);
      })(start);
    }

    /* ---- cursor spotlight on cards ---- */
    if (finePointer) {
      document.addEventListener("pointermove", function (e) {
        var c = e.target.closest && e.target.closest(".card, .plan");
        if (!c) return;
        var r = c.getBoundingClientRect();
        c.style.setProperty("--mx", (e.clientX - r.left) + "px");
        c.style.setProperty("--my", (e.clientY - r.top) + "px");
      }, { passive: true });
    }

    /* ---- button ripple ---- */
    document.addEventListener("pointerdown", function (e) {
      var b = e.target.closest && e.target.closest(".btn");
      if (!b || b.disabled || reduce) return;
      var r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2;
      var s = document.createElement("span"); s.className = "ripple";
      s.style.cssText = "width:" + d + "px;height:" + d + "px;left:" + (e.clientX - r.left - d / 2) + "px;top:" + (e.clientY - r.top - d / 2) + "px";
      b.appendChild(s); setTimeout(function () { s.remove(); }, 650);
    });

    /* ---- logo: light the cells in a quick chase ---- */
    var logo = document.querySelector(".brand .logo");
    function chase() {
      if (!logo || reduce) return;
      var cells = logo.querySelectorAll("i"), order = [0, 1, 2, 5, 8, 7, 6, 3, 4];
      order.forEach(function (n, i) {
        setTimeout(function () { cells[n].classList.add("flash"); setTimeout(function () { cells[n].classList.remove("flash"); }, 160); }, i * 70);
      });
    }
    setTimeout(chase, 450);
    if (logo) logo.parentNode.addEventListener("mouseenter", chase);

    /* ---- copy buttons on code blocks ---- */
    document.querySelectorAll("pre").forEach(function (pre) {
      var wrap = document.createElement("div"); wrap.className = "pre-wrap";
      pre.parentNode.insertBefore(wrap, pre); wrap.appendChild(pre);
      var b = document.createElement("button"); b.type = "button"; b.className = "copy"; b.textContent = "Copy";
      b.onclick = function () {
        var txt = pre.textContent;
        var done = function () { b.textContent = "Copied"; b.classList.add("done"); setTimeout(function () { b.textContent = "Copy"; b.classList.remove("done"); }, 1600); };
        if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done, function () {}); else done();
      };
      wrap.appendChild(b);
    });

    initConsole();
  });

  /* ================= hero studio console ================= */
  function initConsole() {
    var con = document.getElementById("console");
    if (!con) return;
    var rows = Array.prototype.slice.call(con.querySelectorAll(".seq .row"));
    var grid = rows.map(function (r) { return Array.prototype.slice.call(r.querySelectorAll(".steps16 i")); });
    var pads = Array.prototype.slice.call(con.querySelectorAll(".pad"));
    var meters = Array.prototype.slice.call(con.querySelectorAll(".meter b"));
    var knobs = Array.prototype.slice.call(con.querySelectorAll(".mix .knob i"));
    var head = con.querySelector(".playhead");
    var bpmEl = con.querySelector("[data-bpm]");
    var bar = con.querySelector(".prompt-bar"), txt = bar && bar.querySelector(".txt"), status = bar && bar.querySelector(".status");

    /* Each song: a prompt, a tempo and a 16-step pattern for each row (x = hit). */
    var SONGS = [
      { p: "slow lo-fi beat, my vocal chopped on the offbeat", bpm: 84, k: [.35, .6, .7],
        r: ["x...x...x...x...", "..x...x...x...xx", "x..x....x.x.....", ".x...x...x...x..", "x.......x......."] },
      { p: "dark trap at 140, my guitar pitched down and reversed", bpm: 140, k: [.2, .8, .45],
        r: ["x.....x...x.....", "xxxxxxxxx.x.xxxx", "x.....x.x.....x.", "....x.......x...", "x..............."] },
      { p: "bright house groove, keys on every bar, vocal up front", bpm: 124, k: [.75, .3, .6],
        r: ["x...x...x...x...", "..x...x...x...x.", "x.xx..x.x.xx..x.", "x...x.....x.x...", "..x...x...x...x."] },
      { p: "dusty boom bap, swing it, my sample as the hook", bpm: 92, k: [.5, .55, .8],
        r: ["x......xx.x.....", "x.x.x.x.x.x.x.x.", "x......x..x.....", "..x.......x.....", "x.......x......."] }
    ];
    var padColor = ["", "t", "", "g", "g", "t", "", ""];

    function applyPattern(song, animate) {
      rows.forEach(function (row, ri) {
        var yours = row.classList.contains("yours");
        grid[ri].forEach(function (cell, ci) {
          var on = song.r[ri].charAt(ci) === "x";
          var cls = yours ? "y" : "on";
          var was = cell.classList.contains(cls);
          if (on === was) return;
          var go = function () {
            cell.classList.toggle(cls, on);
            if (on && animate) { cell.classList.remove("pop"); void cell.offsetWidth; cell.classList.add("pop"); }
          };
          if (animate) setTimeout(go, ci * 28 + ri * 40); else go();
        });
      });
      if (bpmEl) bpmEl.textContent = song.bpm;
      knobs.forEach(function (k, i) { k.style.setProperty("--v", song.k[i] != null ? song.k[i] : .5); });
    }

    if (reduce) { applyPattern(SONGS[0], false); return; }

    /* tilt toward the cursor */
    if (finePointer) {
      var wrap = con.parentNode;
      wrap.addEventListener("pointermove", function (e) {
        var r = wrap.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        con.style.setProperty("--ry", (x * 10 - 4).toFixed(2) + "deg");
        con.style.setProperty("--rx", (-y * 8 + 3).toFixed(2) + "deg");
      });
      wrap.addEventListener("pointerleave", function () { con.style.removeProperty("--ry"); con.style.removeProperty("--rx"); });
    }

    var songIx = 0, song = SONGS[0], step = 0, visible = true, timer = null;
    applyPattern(song, false);

    function tick() {
      if (head) head.style.setProperty("--ph", step);
      var level = 0;
      rows.forEach(function (row, ri) {
        var cells = grid[ri];
        cells.forEach(function (c, ci) { c.classList.toggle("now", ci === step); });
        var hit = song.r[ri].charAt(step) === "x";
        row.classList.toggle("hit", hit);
        if (hit) {
          level += ri === 0 ? .5 : .22;
          var pad = pads[ri]; if (pad) flash(pad, padColor[ri]);
        }
      });
      if (step % 4 === 2 && Math.random() < .5) flash(pads[5 + Math.floor(Math.random() * 3)], padColor[5]);
      meters.forEach(function (m, i) {
        var l = Math.min(1, level * (0.75 + Math.random() * 0.5) + (i % 2 ? .08 : .12));
        m.style.setProperty("--l", l.toFixed(2));
      });
      step = (step + 1) % 16;
    }
    function flash(pad, color) {
      if (!pad) return;
      pad.classList.add("lit"); if (color) pad.classList.add(color);
      setTimeout(function () { pad.classList.remove("lit", "g", "t"); }, 110);
    }
    function schedule() {
      clearInterval(timer);
      if (!visible || document.hidden) return;
      timer = setInterval(tick, 60000 / song.bpm / 4);
    }

    /* prompt: type it, "arrange", play for a while, then the next */
    function typePrompt(text, done) {
      var i = 0; bar.classList.add("busy"); status.textContent = "typing";
      (function next() {
        txt.textContent = text.slice(0, i);
        if (i++ < text.length) setTimeout(next, 26 + Math.random() * 40); else done();
      })();
    }
    function cycle() {
      typePrompt(song.p, function () {
        status.textContent = "arranging";
        setTimeout(function () {
          applyPattern(song, true); schedule();
          bar.classList.remove("busy"); status.textContent = song.bpm + " bpm";
          setTimeout(function () {
            songIx = (songIx + 1) % SONGS.length; song = SONGS[songIx];
            cycle();
          }, 7000);
        }, 650);
      });
    }

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; schedule(); }, { threshold: .05 }).observe(con);
    }
    document.addEventListener("visibilitychange", schedule);
    schedule();
    setTimeout(cycle, 900);
  }
})();
