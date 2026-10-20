/* STUDIO — shared app logic (original code) */
(function () {
  "use strict";

  var CFG_KEY = "studio_cfg";
  var GEN_KEY = "studio_gens";
  var WF_KEY = "studio_workflows";
  var CRED_KEY = "studio_credits";
  var API_BASE = "https://api.morphic.com/v1/partner";

  /* ---------- tiny helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
  function fmtDate(ts) {
    try { return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
    catch (e) { return ""; }
  }
  function timeAgo(ts) {
    var s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
    if (s < 60) return s + "s ago";
    var m = Math.floor(s / 60); if (m < 60) return m + "m ago";
    var h = Math.floor(m / 60); if (h < 24) return h + "h ago";
    var d = Math.floor(h / 24); if (d < 30) return d + "d ago";
    return fmtDate(ts);
  }

  /* ---------- storage ---------- */
  function loadCfg() {
    try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveCfg(cfg) { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); }
  function loadGens() {
    try { return JSON.parse(localStorage.getItem(GEN_KEY)) || []; } catch (e) { return []; }
  }
  function persistGens(gens) { localStorage.setItem(GEN_KEY, JSON.stringify(gens.slice(0, 60))); }
  function addGen(gen) {
    var gens = loadGens();
    gens.unshift(gen);
    persistGens(gens);
    return gen;
  }
  function loadWfs() {
    try { return JSON.parse(localStorage.getItem(WF_KEY)) || []; } catch (e) { return []; }
  }
  function persistWfs(wfs) { localStorage.setItem(WF_KEY, JSON.stringify(wfs)); }

  /* ---------- media models + demo credits + profile ---------- */
  var MEDIA_MODELS = {
    video: [
      { name: "Seedance 2.5", sub: "Long takes · native motion", cost: 3 },
      { name: "Kling 3.0", sub: "Realistic physics", cost: 4 },
      { name: "Veo 3.1", sub: "Cinematic realism", cost: 5 },
      { name: "Hailuo 2.3", sub: "Stylised looks", cost: 4 },
      { name: "MiniMax H3", sub: "Expressive characters", cost: 4 },
      { name: "Wan 3.0", sub: "Open video model", cost: 3 },
      { name: "Vidu Q3", sub: "Fast, vivid clips", cost: 3 },
      { name: "LTX 2.5", sub: "Real-time speed", cost: 2 },
      { name: "Grok Imagine", sub: "Bold, playful styles", cost: 2 },
      { name: "Seedance 2.5 Draft", sub: "Quick previews", cost: 1 }
    ],
    image: [
      { name: "Nano Banana Pro", sub: "Detailed, vivid images", cost: 3 },
      { name: "GPT Image 2.5", sub: "Sharp, accurate renders", cost: 3 },
      { name: "Ideogram 4.5", sub: "Type-safe graphics", cost: 2 },
      { name: "Seedream 5.0 Pro", sub: "Photoreal detail", cost: 3 },
      { name: "Flux 2 Pro", sub: "Pro-grade stills", cost: 2 },
      { name: "Recraft V4.1", sub: "Design & illustration", cost: 2 },
      { name: "Krea 3", sub: "Fast creative images", cost: 2 },
      { name: "Qwen Image 2.1", sub: "Lightweight & quick", cost: 1 }
    ],
    audio: []
  };
  var selByTab = { video: "Seedance 2.5", image: "Nano Banana Pro" };
  var CHECK_SVG = '<span class="check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg></span>';

  function modelCost(name) {
    var all = MEDIA_MODELS.video.concat(MEDIA_MODELS.image);
    for (var i = 0; i < all.length; i++) if (all[i].name === name) return all[i].cost;
    return 3;
  }
  function getCredits() {
    var v = parseInt(localStorage.getItem(CRED_KEY), 10);
    if (isNaN(v)) { v = 100; try { localStorage.setItem(CRED_KEY, String(v)); } catch (e) {} }
    return v;
  }
  function setCredits(v) {
    try { localStorage.setItem(CRED_KEY, String(Math.max(0, v))); } catch (e) {}
    updateCreditBadge();
    var pill = $(".credits-pill");
    if (pill) {
      pill.classList.remove("pulse");
      void pill.offsetWidth;
      pill.classList.add("pulse");
      setTimeout(function () { pill.classList.remove("pulse"); }, 500);
    }
    var bv = $("#credBalanceView");
    if (bv) bv.textContent = "⚡" + getCredits();
  }
  function updateCreditBadge() {
    var cb = $("#creditBadge");
    if (cb) cb.textContent = isLive() ? "Live" : getCredits();
  }
  function loadProfile() {
    var c = loadCfg();
    return c.profile || { name: "", color: "#2b7fff" };
  }
  function updateAvatar() {
    var p = loadProfile();
    $all("#topAvatar").forEach(function (a) {
      a.textContent = ((p.name || "A").charAt(0) || "A").toUpperCase();
      a.style.background = p.color || "#2b7fff";
    });
  }
  function maybeNotify(title, body) {
    try {
      var cfg = loadCfg();
      if (cfg.notify && "Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body: String(body).slice(0, 120) });
      }
    } catch (e) {}
  }

  /* ---------- bundled demo videos (real clips, honest labels) ---------- */
  var BUNDLED_DEMOS = [
    { src: "assets/demos/demo1.mp4", title: "Golden-hour property showcase", model: "Seedance 2.5", type: "video", createdAt: Date.now() - 2 * 864e5 },
    { src: "assets/demos/demo2.mp4", title: "Lifestyle product clip", model: "Kling 2.0", type: "video", createdAt: Date.now() - 3 * 864e5 },
    { src: "assets/demos/demo3.mp4", title: "Yogabars product ad — AI UGC", model: "Seedance 2.5", type: "video", createdAt: Date.now() - 5 * 864e5 },
    { src: "assets/demos/demo4.mp4", title: "Test render", model: "Kling 2.0", type: "video", createdAt: Date.now() - 6 * 864e5 },
    { src: "assets/demos/demo5.mp4", title: "Cinematic club entry — AI music video", model: "Seedance 2.5", type: "video", createdAt: Date.now() - 1 * 864e5 },
    { src: "assets/demos/demo6.mp4", title: "Mountain road drive — Defender film", model: "Kling 3.0", type: "video", createdAt: Date.now() - 2 * 864e5 },
    { src: "assets/demos/demo7.mp4", title: "Beach sunset drive", model: "Hailuo 2.3", type: "video", createdAt: Date.now() - 3 * 864e5 },
    { src: "assets/demos/demo8.mp4", title: "The Dare — horror short", model: "Seedance 2.5", type: "video", createdAt: Date.now() - 4 * 864e5 }
  ];
  function demoVideoCard(d, compact) {
    return '<article class="gen-card demo-video-card' + (compact ? " featured-card" : "") + '">' +
      '<div class="thumb"><video src="' + esc(d.src) + '" muted loop playsinline preload="metadata"></video>' +
      '<span class="play">' + PLAY_SVG + "</span></div>" +
      '<div class="gen-body"><p class="gen-prompt">' + esc(d.title) + "</p>" +
      '<div class="gen-meta"><span class="badge done">Done</span> <span class="badge sample">Demo</span>' +
      "<span>" + esc(d.model) + '</span><span class="dot-sep">•</span>' +
      "<span>" + esc(timeAgo(d.createdAt)) + "</span>" +
      "</div></div></article>";
  }
  function bindDemoVideos(root) {
    $all(".demo-video-card", root || document).forEach(function (card) {
      var vid = card.querySelector("video");
      if (!vid) return;
      card.addEventListener("click", function () {
        var isPlaying = card.classList.contains("playing");
        $all(".demo-video-card").forEach(function (c) {
          c.classList.remove("playing");
          var v = c.querySelector("video");
          if (v && v !== vid) { try { v.pause(); } catch (e) {} }
        });
        if (!isPlaying) {
          try {
            var p = vid.play();
            if (p && p.catch) p.catch(function () {});
          } catch (e) {}
          card.classList.add("playing");
        } else {
          try { vid.pause(); } catch (e) {}
        }
      });
      vid.addEventListener("pause", function () { card.classList.remove("playing"); });
      vid.addEventListener("play", function () { card.classList.add("playing"); });
    });
  }

  function isLive() {
    var c = loadCfg();
    return !c.demoMode && !!(c.apiKey && c.orgId && c.projectId && c.workflowId);
  }

  /* ---------- toast ---------- */
  var toastTimer = null;
  var TOAST_ICONS = { ok: "\u2713", err: "\u2715", info: "\u2139" };
  function toast(msg, kind) {
    var t = $("#toast");
    if (!t) { alert(msg); return; }
    kind = TOAST_ICONS[kind] ? kind : "info";
    t.innerHTML = '<span class="t-ico">' + TOAST_ICONS[kind] + "</span><span>" + esc(msg) + "</span>";
    t.className = "toast show " + kind;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = "toast"; }, 3000);
  }

  /* ---------- nav / drawer ---------- */
  function initChrome() {
    var page = document.body.getAttribute("data-page");
    $all(".nav a").forEach(function (a) {
      if (a.getAttribute("data-nav") === page) a.classList.add("active");
    });
    var burger = $("#hamburger"), sidebar = $("#sidebar"), scrim = $("#scrim");
    function close() { sidebar.classList.remove("open"); scrim.classList.remove("show"); }
    if (burger && sidebar && scrim) {
      burger.addEventListener("click", function () {
        sidebar.classList.toggle("open");
        scrim.classList.toggle("show");
      });
      scrim.addEventListener("click", close);
      $all(".nav a", sidebar).forEach(function (a) { a.addEventListener("click", close); });
    }
    // footer mode pill + credits pill
    var pill = $("#modePill");
    var live = isLive();
    if (pill) {
      pill.innerHTML = '<span class="mode-dot' + (live ? " live" : "") + '"></span>' +
        (live ? "Live API connected" : "Demo mode");
      pill.title = live ? "Real renders via your API key" : "Simulated renders — connect an API key in Settings to go live";
    }
    updateCreditBadge();
    updateAvatar();
  }

  /* ---------- thumbnails (pure CSS gradients) ---------- */
  var GRADIENTS = [
    ["#2b7fff", "#2a1a5e"], ["#0ea5e9", "#1e1b4b"], ["#f472b6", "#4c1d95"],
    ["#34d399", "#064e3b"], ["#fbbf24", "#7c2d12"], ["#60a5fa", "#312e81"],
    ["#a78bfa", "#0f172a"], ["#fb7185", "#3b0764"], ["#22d3ee", "#134e4a"],
    ["#e879f9", "#1e1b4b"]
  ];
  function thumbBg(seed) {
    var h = 0, s = String(seed);
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    var g = GRADIENTS[h % GRADIENTS.length];
    return "background:linear-gradient(135deg," + g[0] + " 0%," + g[1] + " 130%)";
  }
  var PLAY_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';

  /* ---------- generation card html ---------- */
  function genCard(g) {
    var ratioCls = g.ratio === "9:16" ? " ratio-916" : (g.ratio === "1:1" ? " ratio-11" : "");
    var badge = g.status === "completed"
      ? '<span class="badge done">Done</span>'
      : g.status === "failed"
        ? '<span class="badge failed">Failed</span>'
        : '<span class="badge running">Running</span>';
    var sample = g.demo ? ' <span class="badge sample">Demo</span>' : "";
    return '<article class="gen-card">' +
      '<div class="thumb' + ratioCls + '" style="' + thumbBg(g.id || g.prompt) + '">' +
        '<span class="play">' + PLAY_SVG + "</span>" +
        '<div class="thumb-actions">' +
          '<button class="icon-btn" data-act="view" title="View"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>' +
          '<button class="icon-btn" data-act="dl" title="Download"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg></button>' +
        "</div>" +
      "</div>" +
      '<div class="gen-body"><p class="gen-prompt">' + esc(g.prompt) + "</p>" +
      '<div class="gen-meta">' + badge + sample +
        '<span>' + esc(g.model || "—") + '</span><span class="dot-sep">•</span>' +
        "<span>" + esc(g.createdAt ? timeAgo(g.createdAt) : "") + "</span>" +
      "</div></div></article>";
  }
  function bindCardActions(root) {
    $all(".gen-card", root || document).forEach(function (card) {
      $all("[data-act]", card).forEach(function (btn) {
        btn.addEventListener("click", function (ev) {
          ev.preventDefault();
          toast(btn.getAttribute("data-act") === "view"
            ? "Preview opens after a real render finishes."
            : "Downloads are available on completed renders.", "");
        });
      });
    });
  }

  /* ---------- sample data (clearly labelled, demo only) ---------- */
  function sampleGens() {
    var now = Date.now();
    return [
      { id: "sample-1", prompt: "Golden-hour product shot: a perfume bottle on wet black stone, slow cinematic orbit, soft mist.", model: "Seedance 2.5", ratio: "16:9", duration: "10s", createdAt: now - 36e5 * 5, status: "completed", demo: true },
      { id: "sample-2", prompt: "Vertical street-style clip: neon reflections on rain-soaked pavement, footsteps passing the camera.", model: "Kling 2.0", ratio: "9:16", duration: "5s", createdAt: now - 36e5 * 26, status: "completed", demo: true },
      { id: "sample-3", prompt: "Cozy cabin interior at dawn, fireplace glow, camera drifts toward the window and snowy pines.", model: "Luma Dream Machine", ratio: "16:9", duration: "10s", createdAt: now - 36e5 * 50, status: "completed", demo: true }
    ];
  }

  /* ---------- dashboard ---------- */
  function estCredits(g) {
    var d = parseInt(g.duration, 10);
    if (d >= 30) return 50;
    if (d >= 10) return 20;
    return 10;
  }
  function initDashboard() {
    var gens = loadGens();
    var show = gens.length ? gens : (loadCfg().demoMode !== false ? sampleGens() : []);
    // stats
    var week = Date.now() - 7 * 864e5;
    $("#stTotal").innerHTML = gens.length + '<span class="unit"> videos</span>';
    var credits = gens.reduce(function (a, g) { return a + estCredits(g); }, 0);
    $("#stCredits").innerHTML = credits + '<span class="unit"> est.</span>';
    $("#stWf").innerHTML = loadWfs().length + '<span class="unit"> saved</span>';
    $("#stWeek").innerHTML = gens.filter(function (g) { return g.createdAt > week; }).length + '<span class="unit"> videos</span>';
    // recent row
    var row = $("#recentRow"), empty = $("#recentEmpty");
    if (show.length) {
      empty.style.display = "none";
      row.innerHTML = show.slice(0, 8).map(genCard).join("");
      bindCardActions(row);
    } else {
      row.innerHTML = "";
      empty.style.display = "block";
    }
    // featured renders strip (bundled demo clips)
    var strip = $("#featuredStrip");
    if (strip) {
      var featuredSrcs = ["assets/demos/demo1.mp4", "assets/demos/demo5.mp4", "assets/demos/demo6.mp4", "assets/demos/demo8.mp4"];
      var featured = featuredSrcs.map(function (s) {
        return BUNDLED_DEMOS.filter(function (d) { return d.src === s; })[0];
      }).filter(Boolean);
      strip.innerHTML = featured.map(function (d) { return demoVideoCard(d, true); }).join("");
      bindDemoVideos(strip);
    }
  }

  /* ---------- gallery ---------- */
  function initGallery() {
    var gens = loadGens();
    var cfg = loadCfg();
    var all = gens.length ? gens : (cfg.demoMode !== false ? sampleGens() : []);
    var view = null, filter = null;
    try {
      view = localStorage.getItem("studio_assets_view") || "grid";
      filter = localStorage.getItem("studio_assets_filter") || "all";
    } catch (e) { view = "grid"; filter = "all"; }
    function apply() {
      var grid = $("#galleryGrid"), empty = $("#galleryEmpty");
      if (!grid) return;
      var show = all.filter(function (g) { return filter === "all" || (g.type || "video") === filter; });
      var demos = BUNDLED_DEMOS.filter(function (d) { return filter === "all" || d.type === filter; });
      grid.classList.toggle("list", view === "list");
      if (show.length || demos.length) {
        empty.style.display = "none";
        grid.innerHTML = show.map(genCard).join("") + demos.map(demoVideoCard).join("");
        bindCardActions(grid);
        bindDemoVideos(grid);
      } else {
        grid.innerHTML = "";
        empty.style.display = "block";
      }
      $all("#assetChips .chip").forEach(function (c) {
        c.classList.toggle("sel", c.getAttribute("data-f") === filter);
      });
      $all("#viewToggle .vt").forEach(function (b) {
        b.classList.toggle("sel", b.getAttribute("data-v") === view);
      });
      var note = $("#galleryNote");
      if (note) note.style.display = (!gens.length && all.length) ? "block" : "none";
    }
    $all("#assetChips .chip").forEach(function (c) {
      c.addEventListener("click", function () {
        filter = c.getAttribute("data-f");
        try { localStorage.setItem("studio_assets_filter", filter); } catch (e) {}
        apply();
      });
    });
    $all("#viewToggle .vt").forEach(function (b) {
      b.addEventListener("click", function () {
        view = b.getAttribute("data-v");
        try { localStorage.setItem("studio_assets_view", view); } catch (e) {}
        apply();
      });
    });
    var skelMs = (typeof window.STUDIO_SKEL_MS === "number") ? window.STUDIO_SKEL_MS : 600;
    (function skeletons() {
      var grid = $("#galleryGrid");
      if (!grid) return;
      grid.classList.remove("list");
      grid.innerHTML = new Array(6 + 1).join('<div class="skel"></div>');
    })();
    setTimeout(apply, skelMs);
  }

  /* ---------- activity page ---------- */
  function initActivity() {
    var gens = loadGens();
    var list = $("#actList"), empty = $("#actEmpty");
    if (!list) return;
    if (!gens.length) { list.innerHTML = ""; empty.style.display = "block"; return; }
    empty.style.display = "none";
    list.innerHTML = gens.map(function (g) {
      var type = g.type || "video";
      var badge = g.status === "completed"
        ? '<span class="badge done">Done</span>'
        : g.status === "failed"
          ? '<span class="badge failed">Failed</span>'
          : '<span class="badge running">Running</span>';
      var sample = g.demo ? ' <span class="badge sample">Demo</span>' : "";
      var ic = type === "image" ? "&#9638;" : "&#9654;";
      var when = "";
      try { when = new Date(g.createdAt).toLocaleString(); } catch (e) {}
      return '<div class="act-row"><div class="act-ic">' + ic + "</div>" +
        '<div class="act-main"><p class="act-prompt" title="' + esc(g.prompt) + '">' + esc(g.prompt) + "</p>" +
        '<div class="act-meta"><span class="type-tag">' + esc(type) + "</span>" +
        "<span>" + esc(g.model || "—") + '</span><span class="dot-sep">•</span>' +
        '<span title="' + esc(when) + '">' + esc(timeAgo(g.createdAt)) + "</span>" + sample +
        "</div></div>" + badge + "</div>";
    }).join("");
  }

  /* ---------- command palette (Ctrl+K) ---------- */
  function goUrl(u) {
    var here = location.pathname.split("/").pop() || "index.html";
    var target = u.split("#")[0];
    if (target === here && u.indexOf("#") === -1) { closePalette(); return; }
    location.href = u;
  }
  var __palOverlay = null;
  function closePalette() {
    if (__palOverlay) __palOverlay.classList.remove("show");
  }
  function initPalette() {
    var overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.id = "paletteOverlay";
    overlay.innerHTML =
      '<div class="dialog palette">' +
      '<input type="text" id="palInput" placeholder="Type a command or search pages…" autocomplete="off" aria-label="Command palette">' +
      '<div class="pal-list" id="palList"></div>' +
      '<div class="pal-foot"><span><b>\u2191\u2193</b> navigate</span><span><b>Enter</b> select</span><span><b>Esc</b> close</span></div>' +
      "</div>";
    document.body.appendChild(overlay);
    __palOverlay = overlay;
    var input = $("#palInput", overlay);
    var list = $("#palList", overlay);
    var items = [
      { t: "Go to Home", k: "page", run: function () { goUrl("index.html"); } },
      { t: "Go to Create", k: "page", run: function () { goUrl("create.html"); } },
      { t: "Go to Assets", k: "page", run: function () { goUrl("gallery.html"); } },
      { t: "Go to Activity", k: "page", run: function () { goUrl("activity.html"); } },
      { t: "Go to Workflows", k: "page", run: function () { goUrl("workflows.html"); } },
      { t: "Go to Settings", k: "page", run: function () { goUrl("settings.html"); } },
      { t: "New video", k: "action", run: function () { goUrl("create.html"); } },
      { t: "New image", k: "action", run: function () { goUrl("create.html#image"); } },
      { t: "New workflow", k: "action", run: function () { goUrl("workflows.html"); } },
      { t: "Toggle demo mode", k: "action", run: function () {
          var c = loadCfg();
          c.demoMode = !(c.demoMode !== false);
          saveCfg(c); initChrome();
          toast(c.demoMode ? "Demo mode on." : "Demo mode off — live mode needs API keys.", "ok");
        } },
      { t: "Reset demo credits", k: "action", run: function () {
          setCredits(100); toast("Demo credits reset to 100.", "ok");
        } }
    ];
    var sel = 0, filtered = items;
    function paint() {
      $all(".pal-item", list).forEach(function (b, i) {
        b.classList.toggle("sel", i === sel);
      });
    }
    function render() {
      if (!filtered.length) { list.innerHTML = '<div class="pal-empty">No matches.</div>'; return; }
      function btnHTML(it) {
        var i = filtered.indexOf(it);
        return '<button type="button" class="pal-item' + (i === sel ? " sel" : "") + '" data-i="' + i + '">' +
          "<span>" + esc(it.t) + '</span><span class="k">' + esc(it.k) + "</span></button>";
      }
      var pages = filtered.filter(function (it) { return it.k === "page"; });
      var actions = filtered.filter(function (it) { return it.k !== "page"; });
      var html = "";
      if (pages.length) html += '<div class="pal-group">Pages</div>' + pages.map(btnHTML).join("");
      if (actions.length) html += '<div class="pal-group">Actions</div>' + actions.map(btnHTML).join("");
      list.innerHTML = html;
      $all(".pal-item", list).forEach(function (b) {
        var i = parseInt(b.getAttribute("data-i"), 10);
        b.addEventListener("click", function () { choose(i); });
        b.addEventListener("mousemove", function () { sel = i; paint(); });
      });
    }
    function choose(i) {
      var it = filtered[i];
      closePalette();
      if (it) it.run();
    }
    function open() {
      input.value = "";
      filtered = items; sel = 0;
      render();
      overlay.classList.add("show");
      setTimeout(function () { input.focus(); }, 30);
    }
    input.addEventListener("input", function () {
      var q = input.value.trim().toLowerCase();
      filtered = items.filter(function (it) { return it.t.toLowerCase().indexOf(q) !== -1; });
      sel = 0;
      render();
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); sel = (sel + 1) % Math.max(1, filtered.length); paint(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sel = (sel - 1 + filtered.length) % Math.max(1, filtered.length); paint(); }
      else if (e.key === "Enter") { e.preventDefault(); choose(sel); }
      else if (e.key === "Escape") { closePalette(); }
    });
    overlay.addEventListener("click", function (e) { if (e.target === overlay) closePalette(); });
    document.addEventListener("keydown", function (e) {
      var k = (e.key || "").toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === "k") {
        e.preventDefault();
        if (overlay.classList.contains("show")) closePalette(); else open();
      } else if (e.key === "Escape") { closePalette(); }
    });
    var ss = $("#sideSearch");
    if (ss) ss.addEventListener("click", open);
  }

  /* ---------- home: create-new dropdown ---------- */
  function initCreateNew() {
    var btn = $("#createNewBtn"), menu = $("#createNewMenu");
    if (!btn || !menu) return;
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      menu.classList.toggle("show");
    });
    document.addEventListener("click", function (e) {
      if (!menu.contains(e.target)) menu.classList.remove("show");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") menu.classList.remove("show");
    });
  }

  /* ---------- option cards (create page) ---------- */
  function initOptGroups() {
    $all("[data-opt-group]").forEach(function (group) {
      var name = group.getAttribute("data-opt-group");
      $all(".opt", group).forEach(function (btn) {
        btn.addEventListener("click", function () {
          $all(".opt", group).forEach(function (b) { b.classList.remove("sel"); });
          btn.classList.add("sel");
          var hidden = document.getElementById("f_" + name);
          if (hidden) hidden.value = btn.getAttribute("data-value");
        });
      });
    });
  }
  function initUpload() {
    var input = $("#refInput"), previews = $("#refPreviews"), drop = $("#dropZone");
    if (!input || !previews) return;
    if (drop) drop.addEventListener("click", function () { input.click(); });
    input.addEventListener("change", function () {
      previews.innerHTML = "";
      Array.prototype.slice.call(input.files || []).slice(0, 4).forEach(function (f) {
        if (!f.type.match(/^image\//)) return;
        var r = new FileReader();
        r.onload = function () {
          var img = document.createElement("img");
          img.src = r.result; img.alt = "Reference preview";
          previews.appendChild(img);
        };
        r.readAsDataURL(f);
      });
      if (input.files && input.files.length) toast(input.files.length + " reference image(s) attached (local preview only).", "ok");
    });
  }

  /* ---------- create page: media tabs + model grid ---------- */
  function currentType() {
    var t = document.querySelector(".tab.active");
    return t ? t.getAttribute("data-type") : "video";
  }
  function renderModels(type) {
    var grid = $("#modelGrid");
    if (!grid) return;
    var list = MEDIA_MODELS[type] || [];
    var want = selByTab[type] || (list[0] && list[0].name);
    grid.innerHTML = list.map(function (m) {
      return '<button type="button" class="opt' + (m.name === want ? " sel" : "") + '" data-value="' + esc(m.name) + '">' +
        CHECK_SVG +
        '<span class="cost">⚡' + m.cost + "</span>" +
        '<span class="opt-name">' + esc(m.name) + "</span>" +
        '<div class="opt-sub">' + esc(m.sub) + "</div></button>";
    }).join("");
    $all(".opt", grid).forEach(function (btn) {
      btn.addEventListener("click", function () {
        $all(".opt", grid).forEach(function (b) { b.classList.remove("sel"); });
        btn.classList.add("sel");
        var v = btn.getAttribute("data-value");
        var fm = $("#f_model");
        if (fm) fm.value = v;
        selByTab[type] = v;
        updateGenBtn();
      });
    });
    var fm = $("#f_model");
    if (fm && want) fm.value = want;
  }
  function setMediaType(type, skipHash) {
    if (!MEDIA_MODELS.hasOwnProperty(type)) type = "video";
    $all(".tab").forEach(function (t) { t.classList.toggle("active", t.getAttribute("data-type") === type); });
    var isAudio = type === "audio";
    var isImage = type === "image";
    var mf = $("#modelField"), df = $("#durationField"), rf = $("#refField"),
        soon = $("#audioSoon"), gen = $("#generateBtn");
    if (mf) mf.style.display = isAudio ? "none" : "";
    if (df) df.style.display = (isAudio || isImage) ? "none" : "";
    if (rf) rf.style.display = isAudio ? "none" : "";
    if (soon) soon.style.display = isAudio ? "block" : "none";
    if (gen) gen.style.display = isAudio ? "none" : "";
    if (!isAudio) renderModels(type);
    updateGenBtn();
    if (!skipHash) {
      try {
        history.replaceState(null, "", type === "video" ? location.pathname + location.search : "#" + type);
      } catch (e) {}
    }
  }
  function setGenBtnLabel(mode) {
    var btn = $("#generateBtn");
    if (!btn) return;
    var span = btn.querySelector("span");
    if (mode === "busy") {
      btn.disabled = true;
      if (span) span.textContent = "Generating…";
      return;
    }
    btn.disabled = false;
    var type = currentType();
    var label = type === "image" ? "Generate image" : "Generate video";
    var fm = $("#f_model");
    var cost = modelCost(fm ? fm.value : "");
    if (span) span.textContent = label + " • ⚡" + cost;
  }
  function updateGenBtn() { setGenBtnLabel("idle"); }

  /* ---------- generation engine ---------- */
  var STEP_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>';
  function setStep(idx, state, sub) {
    var steps = $all(".step");
    steps.forEach(function (s, i) {
      s.classList.remove("active", "done", "error");
      var dot = $(".step-dot", s);
      if (i < idx) { s.classList.add("done"); if (dot) dot.innerHTML = STEP_CHECK; }
      else if (i === idx) {
        s.classList.add(state === "error" ? "error" : state === "done" ? "done" : "active");
        if (dot && state === "done") dot.innerHTML = STEP_CHECK;
      }
    });
    if (sub != null) {
      var el = steps[idx] && $(".step-s", steps[idx]);
      if (el) el.textContent = sub;
    }
  }
  function setBar(pct) { var b = $("#genBar"); if (b) b.style.width = Math.min(100, Math.max(0, pct)) + "%"; }
  function logLine(msg, cls) {
    var log = $("#genLog");
    if (!log) return;
    var div = document.createElement("div");
    if (cls) div.className = cls;
    div.textContent = msg;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }
  function stripWf(id) {
    id = String(id || "").trim();
    return id.toLowerCase().indexOf("wf-") === 0 ? id.slice(3) : id;
  }

  function demoGenerate(job) {
    setStep(0, "active", "Demo render queued…");
    logLine("Demo mode: simulating a render locally (no credits spent).", "inf");
    var pct = 0, step = 0;
    var stages = ["Queued", "Rendering", "Finalizing"];
    var subs = ["Job accepted", "Diffusing frames…", "Temporal + polish pass…", "Complete"];
    var timer = setInterval(function () {
      pct += 4 + Math.random() * 7;
      if (pct >= 100) {
        clearInterval(timer);
        setBar(100);
        setStep(3, "done", subs[3]);
        logLine("Render complete (simulated).", "ok");
        var gen = {
          id: uuid(), prompt: job.prompt, model: job.model, ratio: job.ratio,
          duration: job.duration, type: job.type || "video",
          createdAt: Date.now(), status: "completed", demo: true
        };
        addGen(gen);
        setCredits(getCredits() - (job.cost || 3));
        maybeNotify("Render complete", job.prompt);
        finishGenerate(gen, true);
      } else {
        var ns = Math.min(2, Math.floor(pct / 34));
        if (ns !== step) { step = ns; setStep(step, "active", subs[step]); logLine(stages[step] + "…"); }
        setBar(pct);
      }
    }, 420);
  }

  function apiErrorMessage(status, bodyText) {
    if (status === 401) return "API key rejected (401). Check the key in Settings — it may be expired or truncated.";
    if (status === 403) {
      if (!bodyText) return "Request blocked (403, empty reply). The API edge blocked this browser request — use Demo mode or run calls from a small server-side proxy.";
      return "Access forbidden (403): " + bodyText.slice(0, 160);
    }
    if (status === 404) return "Endpoint not found (404). The workflow or project ID may be wrong.";
    if (status === 429) return "Rate limited (429). Wait a minute and try again.";
    return "Request failed (HTTP " + status + "). " + (bodyText || "").slice(0, 160);
  }

  function realGenerate(cfg, job) {
    var wid = stripWf(cfg.workflowId || job.workflowId);
    setStep(0, "active", "Contacting render service…");
    logLine("POST " + API_BASE + "/workflow-runs", "inf");
    var body = {
      org_id: String(cfg.orgId).trim(),
      project_id: String(cfg.projectId).trim(),
      workflow_id: wid,
      idempotency_key: uuid(),
      inputs: { prompt: job.prompt, model: job.model, aspect_ratio: job.ratio, duration: job.duration }
    };
    fetch(API_BASE + "/workflow-runs", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + cfg.apiKey },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.text().then(function (txt) {
        var data = {};
        try { data = txt ? JSON.parse(txt) : {}; } catch (e) { /* non-JSON */ }
        if (!res.ok) throw { http: res.status, text: txt };
        return data;
      });
    }).then(function (data) {
      var runId = data.id || data.run_id || (data.run && data.run.id);
      if (!runId) throw { http: 0, text: "No run id in response." };
      logLine("Run started: " + runId, "ok");
      pollRun(cfg, runId, job, 0);
    }).catch(function (err) {
      if (err && err.http != null) {
        logLine(apiErrorMessage(err.http, err.text), "err");
      } else {
        logLine("Network error: the browser could not reach the API. This is usually CORS or connectivity — switch on Demo mode or use a server-side proxy.", "err");
      }
      setStep(0, "error", "Failed");
      setGenBtnLabel("idle");
      toast("Generation failed — see the log.", "err");
    });
  }

  function pollRun(cfg, runId, job, attempt) {
    var MAX = 36; // ~3 minutes at 5s cadence (each poll long-waits server-side)
    if (attempt >= MAX) {
      logLine("Timed out waiting (~3 min). The run may still finish — check Workflows.", "err");
      setStep(2, "error", "Timed out");
      setGenBtnLabel("idle");
      return;
    }
    setStep(1, "active", "Run " + runId.slice(0, 8) + "… (poll " + (attempt + 1) + ")");
    fetch(API_BASE + "/workflow-runs/" + encodeURIComponent(runId) + "?wait=30", {
      headers: { "Authorization": "Bearer " + cfg.apiKey }
    }).then(function (res) {
      return res.text().then(function (txt) {
        var data = {};
        try { data = txt ? JSON.parse(txt) : {}; } catch (e) {}
        if (!res.ok) throw { http: res.status, text: txt };
        return data;
      });
    }).then(function (data) {
      var st = String(data.status || data.state || "").toLowerCase();
      logLine("status: " + (st || "unknown"));
      if (st === "completed" || st === "succeeded" || st === "success" || st === "done") {
        setBar(100); setStep(3, "done", "Complete");
        logLine("Render finished.", "ok");
        var outs = data.outputs || data.output || {};
        var gen = {
          id: uuid(), prompt: job.prompt, model: job.model, ratio: job.ratio,
          duration: job.duration, type: job.type || "video",
          createdAt: Date.now(), status: "completed",
          demo: false, runId: runId, outputs: outs
        };
        addGen(gen);
        finishGenerate(gen, false);
      } else if (st === "failed" || st === "error" || st === "cancelled") {
        var msg = (data.error && (data.error.message || data.error)) || "run failed";
        logLine("Run failed: " + msg, "err");
        setStep(1, "error", "Failed");
        setGenBtnLabel("idle");
        toast("Render failed: " + String(msg).slice(0, 120), "err");
      } else {
        setBar(Math.min(92, 12 + attempt * 2.4));
        if (attempt > 4) setStep(2, "active", "Still rendering…");
        setTimeout(function () { pollRun(cfg, runId, job, attempt + 1); }, 5000);
      }
    }).catch(function (err) {
      if (err && err.http != null) logLine(apiErrorMessage(err.http, err.text), "err");
      else logLine("Poll network error — retrying…", "err");
      setTimeout(function () { pollRun(cfg, runId, job, attempt + 1); }, 5000);
    });
  }

  function finishGenerate(gen, wasDemo) {
    setGenBtnLabel("idle");
    var res = $("#genResult");
    if (res) {
      res.style.display = "block";
      res.innerHTML = genCard(gen);
      bindCardActions(res);
      if (typeof res.scrollIntoView === "function") res.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    toast(wasDemo ? "Demo render complete — saved to Gallery." : "Render complete — saved to Gallery.", "ok");
  }

  function initCreate() {
    initOptGroups();
    initUpload();
    // media tabs
    $all(".tab").forEach(function (tab) {
      tab.addEventListener("click", function () { setMediaType(tab.getAttribute("data-type")); });
    });
    var cfg0 = loadCfg();
    if (cfg0.defaultModel) selByTab.video = cfg0.defaultModel;
    var h = (location.hash || "").replace("#", "");
    setMediaType(h === "image" ? "image" : (h === "audio" ? "audio" : "video"), true);
    var form = $("#createForm");
    if (!form) return;
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var type = currentType();
      var prompt = $("#f_prompt").value.trim();
      if (prompt.length < 8) { toast("Describe your shot in a little more detail first.", "err"); $("#f_prompt").focus(); return; }
      var modelName = $("#f_model").value || selByTab.video;
      var job = {
        prompt: prompt,
        model: modelName,
        ratio: $("#f_ratio").value || "16:9",
        duration: type === "image" ? "" : ($("#f_duration").value || "10s"),
        type: type,
        cost: modelCost(modelName)
      };
      var cfg = loadCfg();
      if (!isLive() && getCredits() < job.cost) {
        toast("Not enough demo credits (need ⚡" + job.cost + "). Reset them in Settings.", "err");
        return;
      }
      setGenBtnLabel("busy");
      $("#genProgress").style.display = "block";
      $("#genResult").style.display = "none";
      $("#genLog").innerHTML = "";
      setBar(2);
      $all(".step").forEach(function (s, i) {
        s.classList.remove("active", "done", "error");
        var d = $(".step-dot", s);
        if (d) d.textContent = String(i + 1);
      });
      logLine("Job: " + job.model + " · " + job.ratio + (job.duration ? " · " + job.duration : "") + " · " + job.type, "inf");
      if (isLive()) realGenerate(cfg, job);
      else {
        if (!cfg.demoMode && !(cfg.apiKey || cfg.orgId)) {
          logLine("No API configured — running in demo mode. Add keys in Settings for real renders.", "inf");
        }
        demoGenerate(job);
      }
    });
  }

  /* ---------- workflows page ---------- */
  function wfStatusBadge(wf) {
    if (wf.lastStatus === "failed") return '<span class="badge failed">Error</span>';
    if (wf.lastStatus === "ok") return '<span class="badge done">Ready</span>';
    return '<span class="badge queued">Untested</span>';
  }
  function renderWfTable() {
    var wfs = loadWfs();
    var body = $("#wfBody"), empty = $("#wfEmpty"), wrap = $("#wfTableWrap");
    if (!wfs.length) { wrap.style.display = "none"; empty.style.display = "block"; return; }
    wrap.style.display = "block"; empty.style.display = "none";
    body.innerHTML = wfs.map(function (w) {
      return "<tr>" +
        '<td data-th="Name"><b>' + esc(w.name) + "</b></td>" +
        '<td class="id-cell" data-th="Workflow ID" title="' + esc(w.id) + '">' + esc(w.id) + "</td>" +
        '<td data-th="Added">' + esc(w.addedAt ? fmtDate(w.addedAt) : "—") + "</td>" +
        '<td data-th="Last run">' + esc(w.lastRun ? timeAgo(w.lastRun) : "Never") + "</td>" +
        '<td data-th="Status">' + wfStatusBadge(w) + "</td>" +
        '<td data-th="Actions"><div class="row-actions">' +
          '<button class="btn btn-ghost btn-sm" data-wf="use" data-id="' + esc(w.id) + '">Use</button>' +
          '<button class="btn btn-ghost btn-sm" data-wf="check" data-id="' + esc(w.id) + '">Check</button>' +
          '<button class="btn btn-danger btn-sm" data-wf="del" data-id="' + esc(w.id) + '">Delete</button>' +
        "</div></td></tr>";
    }).join("");
    $all("[data-wf]", body).forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-id"), act = b.getAttribute("data-wf");
        var wfs2 = loadWfs();
        var wf = null;
        wfs2.forEach(function (x) { if (x.id === id) wf = x; });
        if (act === "del") {
          persistWfs(wfs2.filter(function (x) { return x.id !== id; }));
          renderWfTable(); toast("Workflow removed.", "ok");
        } else if (act === "use") {
          var cfg = loadCfg(); cfg.workflowId = id; saveCfg(cfg);
          toast("Default workflow set — opening Create.", "ok");
          setTimeout(function () { location.href = "create.html"; }, 600);
        } else if (act === "check" && wf) {
          checkWorkflow(wf);
        }
      });
    });
  }
  function checkWorkflow(wf) {
    var cfg = loadCfg();
    if (!cfg.apiKey) { toast("Add your API key in Settings first.", "err"); return; }
    toast("Reading input contract…", "");
    fetch(API_BASE + "/workflows/" + encodeURIComponent(stripWf(wf.id)) + "/inputs", {
      headers: { "Authorization": "Bearer " + cfg.apiKey }
    }).then(function (r) {
      return r.text().then(function (t) {
        var d = {}; try { d = t ? JSON.parse(t) : {}; } catch (e) {}
        if (!r.ok) throw { http: r.status, text: t };
        return d;
      });
    }).then(function (d) {
      var w = d.workflow || {};
      var inputs = d.inputs || [];
      var names = inputs.map(function (i) { return i.key || i.name; }).filter(Boolean).join(", ");
      wf.lastRun = Date.now(); wf.lastStatus = "ok";
      var wfs = loadWfs().map(function (x) { return x.id === wf.id ? wf : x; });
      persistWfs(wfs); renderWfTable();
      toast("OK — " + (w.name || wf.name) + " · inputs: " + (names || "none listed"), "ok");
    }).catch(function (e) {
      wf.lastStatus = "failed";
      var wfs = loadWfs().map(function (x) { return x.id === wf.id ? wf : x; });
      persistWfs(wfs); renderWfTable();
      toast(e && e.http ? apiErrorMessage(e.http, e.text) : "Network error — the API may block browser calls (CORS).", "err");
    });
  }
  function initWorkflows() {
    renderWfTable();
    var overlay = $("#wfModal"), openBtn = $("#newWfBtn"), closeBtns = $all("[data-close]", overlay);
    openBtn.addEventListener("click", function () { overlay.classList.add("show"); });
    closeBtns.forEach(function (b) { b.addEventListener("click", function () { overlay.classList.remove("show"); }); });
    overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.classList.remove("show"); });
    $("#wfForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var name = $("#wfName").value.trim(), id = $("#wfId").value.trim();
      if (!name || !id) { toast("Name and workflow ID are both required.", "err"); return; }
      var wfs = loadWfs();
      if (wfs.some(function (w) { return w.id.toLowerCase() === id.toLowerCase(); })) {
        toast("That workflow is already in the list.", "err"); return;
      }
      wfs.unshift({ name: name, id: stripWf(id), addedAt: Date.now(), lastRun: 0, lastStatus: null });
      persistWfs(wfs);
      $("#wfName").value = ""; $("#wfId").value = "";
      overlay.classList.remove("show");
      renderWfTable();
      toast("Workflow saved.", "ok");
    });
  }

  /* ---------- settings ---------- */
  function initSettings() {
    var cfg = loadCfg();
    var map = { apiKey: "#s_key", orgId: "#s_org", projectId: "#s_project", workflowId: "#s_workflow" };
    Object.keys(map).forEach(function (k) { var el = $(map[k]); if (el && cfg[k]) el.value = cfg[k]; });
    var demo = $("#s_demo");
    if (demo) demo.checked = cfg.demoMode !== false; // default ON (safe)
    // profile
    var prof = cfg.profile || {};
    var nameEl = $("#s_name");
    if (nameEl && prof.name) nameEl.value = prof.name;
    var swColors = ["#2b7fff", "#7c5cff", "#34d399", "#f472b6", "#fbbf24"];
    var curColor = prof.color || "#2b7fff";
    var sw = $("#avatarSwatches");
    if (sw) {
      sw.innerHTML = swColors.map(function (c) {
        return '<button type="button" class="swatch' + (c === curColor ? " sel" : "") + '" data-c="' + c + '" style="background:' + c + '" aria-label="Avatar color ' + c + '"></button>';
      }).join("");
      sw.addEventListener("click", function (e) {
        var b = e.target.closest ? e.target.closest(".swatch") : null;
        if (!b) return;
        $all(".swatch", sw).forEach(function (x) { x.classList.remove("sel"); });
        b.classList.add("sel");
      });
    }
    // preferences
    var dm = $("#s_model");
    if (dm) {
      dm.innerHTML = MEDIA_MODELS.video.map(function (m) {
        return '<option value="' + esc(m.name) + '"' + (cfg.defaultModel === m.name ? " selected" : "") + ">" + esc(m.name) + "</option>";
      }).join("");
    }
    var nt = $("#s_notify");
    if (nt) {
      nt.checked = !!cfg.notify;
      nt.addEventListener("change", function () {
        if (nt.checked && "Notification" in window && Notification.permission === "default") {
          Notification.requestPermission();
        }
      });
    }
    var bv = $("#credBalanceView");
    if (bv) bv.textContent = "⚡" + getCredits();
    var rc = $("#resetCredBtn");
    if (rc) rc.addEventListener("click", function () { setCredits(100); toast("Demo credits reset to 100.", "ok"); });
    var form = $("#settingsForm");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var selSw = $("#avatarSwatches .swatch.sel");
      var sName = $("#s_name"), sModel = $("#s_model"), sNotify = $("#s_notify");
      saveCfg({
        apiKey: $("#s_key").value.trim(),
        orgId: $("#s_org").value.trim(),
        projectId: $("#s_project").value.trim(),
        workflowId: $("#s_workflow").value.trim(),
        demoMode: $("#s_demo").checked,
        profile: {
          name: sName ? sName.value.trim().slice(0, 24) : "",
          color: selSw ? selSw.getAttribute("data-c") : "#2b7fff"
        },
        defaultModel: sModel ? sModel.value : "",
        notify: !!(sNotify && sNotify.checked)
      });
      initChrome(); // refresh mode pill + avatar
      toast("Settings saved in this browser.", "ok");
    });
    $("#clearBtn").addEventListener("click", function () {
      if (!confirm("Remove the saved API key and IDs from this browser?")) return;
      localStorage.removeItem(CFG_KEY);
      location.reload();
    });
    $("#testBtn").addEventListener("click", function () {
      var key = $("#s_key").value.trim();
      var wid = stripWf($("#s_workflow").value.trim());
      var out = $("#testResult");
      if (!key) { out.innerHTML = '<span style="color:var(--red)">Add an API key first.</span>'; return; }
      if (!wid) { out.innerHTML = '<span style="color:var(--red)">Add a workflow ID to test against.</span>'; return; }
      out.innerHTML = '<span style="color:var(--muted)">Contacting API…</span>';
      fetch(API_BASE + "/workflows/" + encodeURIComponent(wid) + "/inputs", {
        headers: { "Authorization": "Bearer " + key }
      }).then(function (r) {
        return r.text().then(function (t) {
          var d = {}; try { d = t ? JSON.parse(t) : {}; } catch (e) {}
          if (!r.ok) throw { http: r.status, text: t };
          return d;
        });
      }).then(function (d) {
        var w = d.workflow || {};
        out.innerHTML = '<span style="color:var(--green)">Connected.</span> Workflow: <b>' +
          esc(w.name || "(unnamed)") + "</b> · version <span class='mono'>" + esc(w.version_id || "?") + "</span>";
      }).catch(function (e) {
        out.innerHTML = '<span style="color:var(--red)">' + esc(e && e.http ? apiErrorMessage(e.http, e.text) : "Network error — the API may block browser calls (CORS). Try Demo mode.") + "</span>";
      });
    });
  }

  /* test hook (harmless in production) */
  window.__studioTest = { setCredits: setCredits, getCredits: getCredits, toast: toast };

  /* ---------- boot ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    if (window.__studio_booted) return; // guard against double-firing
    window.__studio_booted = true;
    initChrome();
    initPalette();
    var page = document.body.getAttribute("data-page");
    if (page === "home") { initDashboard(); initCreateNew(); }
    else if (page === "gallery") initGallery();
    else if (page === "create") initCreate();
    else if (page === "activity") initActivity();
    else if (page === "workflows") initWorkflows();
    else if (page === "settings") initSettings();
  });
})();
