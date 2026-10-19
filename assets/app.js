/* STUDIO — shared app logic (original code) */
(function () {
  "use strict";

  var CFG_KEY = "studio_cfg";
  var GEN_KEY = "studio_gens";
  var WF_KEY = "studio_workflows";
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

  function isLive() {
    var c = loadCfg();
    return !c.demoMode && !!(c.apiKey && c.orgId && c.projectId && c.workflowId);
  }

  /* ---------- toast ---------- */
  var toastTimer = null;
  function toast(msg, kind) {
    var t = $("#toast");
    if (!t) { alert(msg); return; }
    t.textContent = msg;
    t.className = "toast show" + (kind ? " " + kind : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = "toast"; }, 3400);
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
        (live ? "Live API connected" : "Demo mode — connect API in Settings");
    }
    var cb = $("#creditBadge");
    if (cb) cb.textContent = live ? "Live" : "0";
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
  }

  /* ---------- gallery ---------- */
  function initGallery() {
    var gens = loadGens();
    var cfg = loadCfg();
    var show = gens.length ? gens : (cfg.demoMode !== false ? sampleGens() : []);
    var grid = $("#galleryGrid"), empty = $("#galleryEmpty");
    if (show.length) {
      empty.style.display = "none";
      grid.innerHTML = show.map(genCard).join("");
      bindCardActions(grid);
      var note = $("#galleryNote");
      if (note && !gens.length) note.style.display = "block";
    } else {
      grid.innerHTML = "";
      empty.style.display = "block";
    }
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

  /* ---------- generation engine ---------- */
  function setStep(idx, state, sub) {
    var steps = $all(".step");
    steps.forEach(function (s, i) {
      s.classList.remove("active", "done", "error");
      if (i < idx) s.classList.add("done");
      else if (i === idx) s.classList.add(state === "error" ? "error" : state === "done" ? "done" : "active");
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
    var stages = ["Queued", "Dreaming frames", "Rendering motion", "Upscaling", "Done"];
    var subs = ["Job accepted", "Diffusing keyframes…", "Temporal pass…", "Polish pass…", "Complete"];
    var timer = setInterval(function () {
      pct += 4 + Math.random() * 7;
      if (pct >= 100) {
        clearInterval(timer);
        setBar(100);
        setStep(4, "done", subs[4]);
        logLine("Render complete (simulated).", "ok");
        var gen = {
          id: uuid(), prompt: job.prompt, model: job.model, ratio: job.ratio,
          duration: job.duration, createdAt: Date.now(), status: "completed", demo: true
        };
        addGen(gen);
        finishGenerate(gen, true);
      } else {
        var ns = Math.min(3, Math.floor(pct / 26));
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
      var btn = $("#generateBtn");
      if (btn) { btn.disabled = false; btn.querySelector("span").textContent = "Generate video"; }
      toast("Generation failed — see the log.", "err");
    });
  }

  function pollRun(cfg, runId, job, attempt) {
    var MAX = 36; // ~3 minutes at 5s cadence (each poll long-waits server-side)
    if (attempt >= MAX) {
      logLine("Timed out waiting (~3 min). The run may still finish — check Workflows.", "err");
      setStep(2, "error", "Timed out");
      var btn = $("#generateBtn");
      if (btn) { btn.disabled = false; btn.querySelector("span").textContent = "Generate video"; }
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
          duration: job.duration, createdAt: Date.now(), status: "completed",
          demo: false, runId: runId, outputs: outs
        };
        addGen(gen);
        finishGenerate(gen, false);
      } else if (st === "failed" || st === "error" || st === "cancelled") {
        var msg = (data.error && (data.error.message || data.error)) || "run failed";
        logLine("Run failed: " + msg, "err");
        setStep(1, "error", "Failed");
        var btn = $("#generateBtn");
        if (btn) { btn.disabled = false; btn.querySelector("span").textContent = "Generate video"; }
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
    var btn = $("#generateBtn");
    if (btn) { btn.disabled = false; btn.querySelector("span").textContent = "Generate video"; }
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
    var form = $("#createForm");
    if (!form) return;
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var prompt = $("#f_prompt").value.trim();
      if (prompt.length < 8) { toast("Describe your shot in a little more detail first.", "err"); $("#f_prompt").focus(); return; }
      var job = {
        prompt: prompt,
        model: $("#f_model").value || "Seedance 2.5",
        ratio: $("#f_ratio").value || "16:9",
        duration: $("#f_duration").value || "10s"
      };
      var cfg = loadCfg();
      var btn = $("#generateBtn");
      btn.disabled = true;
      btn.querySelector("span").textContent = "Generating…";
      $("#genProgress").style.display = "block";
      $("#genResult").style.display = "none";
      $("#genLog").innerHTML = "";
      setBar(2);
      $all(".step").forEach(function (s) { s.classList.remove("active", "done", "error"); });
      logLine("Job: " + job.model + " · " + job.ratio + " · " + job.duration, "inf");
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
        "<td><b>" + esc(w.name) + "</b></td>" +
        '<td class="id-cell" title="' + esc(w.id) + '">' + esc(w.id) + "</td>" +
        "<td>" + esc(w.addedAt ? fmtDate(w.addedAt) : "—") + "</td>" +
        "<td>" + esc(w.lastRun ? timeAgo(w.lastRun) : "Never") + "</td>" +
        "<td>" + wfStatusBadge(w) + "</td>" +
        '<td><div class="row-actions">' +
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
    var form = $("#settingsForm");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      saveCfg({
        apiKey: $("#s_key").value.trim(),
        orgId: $("#s_org").value.trim(),
        projectId: $("#s_project").value.trim(),
        workflowId: $("#s_workflow").value.trim(),
        demoMode: $("#s_demo").checked
      });
      initChrome(); // refresh mode pill
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

  /* ---------- boot ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    if (window.__studio_booted) return; // guard against double-firing
    window.__studio_booted = true;
    initChrome();
    var page = document.body.getAttribute("data-page");
    if (page === "home") initDashboard();
    else if (page === "gallery") initGallery();
    else if (page === "create") initCreate();
    else if (page === "workflows") initWorkflows();
    else if (page === "settings") initSettings();
  });
})();
