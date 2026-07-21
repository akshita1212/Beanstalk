/* ============================================================
   From Seed to Ecosystem — scroll-scrubbed beanstalk stage
   - Preloads the WebP frame sequence, draws to canvas
   - The source video is cut into reusable segment templates,
     each starting/ending on a bare stalk:
       seed (0–2s) · left leaf (2–5s) · right leaf (5–8s) · bloom (8–10s)
   - The story timeline is assembled from those templates: one
     leaf segment per solution (alternating sides), then bloom
   - "+ Add solution" appends a solution and rebuilds the story
   - Falls back to the static storyboard for reduced motion,
     missing canvas support, or JS disabled (noscript path)
   ============================================================ */

(function () {
  "use strict";

  var FRAME_COUNT = 160;
  var FRAME_PATH = function (i) {
    return "assets/frames/frame_" + String(i).padStart(3, "0") + ".webp";
  };

  // Segment templates (0-indexed source frames @16fps).
  var SEG = {
    seed:  { from: 0,   to: 32  }, // seed cracks, sprout rises to bare stalk
    left:  { from: 32,  to: 80  }, // left leaf grows, then slides out of frame
    right: { from: 80,  to: 128 }, // right leaf grows, then slides out of frame
    bloom: { from: 128, to: 159 }  // bud forms and the flower opens
  };

  var ICONS = [
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5.5" rx="7.5" ry="3"/><path d="M4.5 5.5v6c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-6"/><path d="M4.5 11.5v6c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-6"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13h4l2.5-6 4 12 2.5-6h5"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3z"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21V9"/><path d="M12 13c0-3.5-2.7-6.3-6-6.5C6.2 10 8.7 12.8 12 13z"/><path d="M12 10c0-3.9 3-7 6.5-7C18.3 6.9 15.5 10 12 10z"/></svg>'
  ];

  var SOLUTIONS = [
    {
      key: "Know",
      title: "Unified Farm Intelligence",
      body: "Every farmer, machine and acre in one living data foundation. Signals from dealers, devices and the field flow into a single intelligent core — the soil that every other solution grows from."
    },
    {
      key: "Serve",
      title: "Predictive Service & Uptime",
      body: "AI listens to every tractor in the field and flags wear before it becomes downtime. Parts, technicians and service windows are scheduled around the harvest — not the other way round."
    }
  ];

  // What the "+ Add solution" button plants next.
  var BACKLOG = [
    {
      key: "Reach",
      title: "Connected Dealer Experience",
      body: "One personalised journey across showroom, web and app. Dealers see what each farmer needs next; farmers feel known at every touchpoint, from first enquiry to trade-in."
    },
    {
      key: "Grow",
      title: "Agronomy Copilot",
      body: "An AI advisor in every farmer's pocket — crop plans, weather calls, machine settings and finance options, answered in the farmer's own language, at the moment of decision."
    }
  ];
  var MAX_SOLUTIONS = 8;
  var COUNT_WORDS = ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"];

  var prefersReduced = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var canvas = document.getElementById("growthCanvas");
  var ctx = canvas && canvas.getContext ? canvas.getContext("2d") : null;

  var scrubSupported = !!(ctx && "requestAnimationFrame" in window);

  // Static storyboard stays visible unless we can (and should) scrub.
  if (prefersReduced || !scrubSupported) return;

  document.documentElement.classList.add("scrub-on");

  var stage = document.getElementById("stage");
  var sticky = stage.querySelector(".stage-sticky");
  var rail = stage.querySelector(".rail");
  var introCaption = document.getElementById("introCaption");
  var finaleCaption = document.getElementById("finaleCaption");
  var finaleText = document.getElementById("finaleText");
  var addBtn = document.getElementById("addSolution");
  var loader = document.getElementById("loader");
  var loaderFill = document.getElementById("loaderFill");
  var loaderPct = document.getElementById("loaderPct");

  /* ---------- Story building ---------- */

  var TIMELINE = [];    // virtual steps -> source frame index
  var overlays = [];    // {el, start, end, visible}
  var ticks = [];       // {el, at}
  var storyRanges = []; // per-solution {sol, side, range} for navigation

  function pushSegment(seg) {
    var start = TIMELINE.length;
    for (var f = seg.from; f <= seg.to; f++) TIMELINE.push(f);
    return { start: start, end: TIMELINE.length - 1 };
  }

  function makeCard(sol, index, side) {
    var el = document.createElement("article");
    el.className = "solution-card js-card " + (side === "left" ? "side-left" : "side-right");
    el.innerHTML =
      '<span class="card-connector" aria-hidden="true"></span>' +
      '<div class="card-head">' +
        '<span class="icon-chip" aria-hidden="true">' + ICONS[index % ICONS.length] + "</span>" +
        '<p class="eyebrow">Solution ' + String(index + 1).padStart(2, "0") + " · " + sol.key + "</p>" +
      "</div>" +
      '<h3 class="card-title"></h3>' +
      '<p class="card-body"></p>';
    el.querySelector(".card-title").textContent = sol.title;
    el.querySelector(".card-body").textContent = sol.body;
    return el;
  }

  function makeTick(at) {
    var el = document.createElement("span");
    el.className = "rail-tick";
    el.innerHTML = "<i></i>";
    el.style.top = (at * 100) + "%";
    return { el: el, at: at };
  }

  function buildStory() {
    // Reset generated DOM
    Array.prototype.slice.call(sticky.querySelectorAll(".js-card")).forEach(function (n) { n.remove(); });
    Array.prototype.slice.call(rail.querySelectorAll(".rail-tick")).forEach(function (n) { n.remove(); });
    TIMELINE = [];
    overlays = [];
    ticks = [];

    var seed = pushSegment(SEG.seed);
    var solRanges = SOLUTIONS.map(function (sol, i) {
      return { sol: sol, side: i % 2 === 0 ? "left" : "right", range: pushSegment(i % 2 === 0 ? SEG.left : SEG.right) };
    });
    storyRanges = solRanges;
    var bloom = pushSegment(SEG.bloom);
    var total = TIMELINE.length - 1;

    // Intro caption across the seed segment
    overlays.push({ el: introCaption, start: 0, end: (seed.end / total) * 0.82, visible: false });

    // One card per solution, timed to the span its leaf is actually on
    // screen (leaf sprouts ~18% into a segment, slides out by ~85%).
    solRanges.forEach(function (s, i) {
      var a = s.range.start / total, b = s.range.end / total, len = b - a;
      var card = makeCard(s.sol, i, s.side);
      sticky.insertBefore(card, finaleCaption);
      overlays.push({ el: card, start: a + len * 0.20, end: a + len * 0.85, visible: false });
      ticks.push(makeTick(a + len * 0.30));
    });

    // Finale caption once the flower opens
    var bloomStart = bloom.start / total;
    overlays.push({ el: finaleCaption, start: bloomStart + (1 - bloomStart) * 0.42, end: 1.01, visible: false });
    finaleText.innerHTML = (COUNT_WORDS[SOLUTIONS.length - 1] || SOLUTIONS.length) +
      " solutions, one root system —<br>growing every farm it touches.";

    ticks.unshift(makeTick(0.04));
    ticks.push(makeTick(bloomStart + (1 - bloomStart) * 0.42));
    ticks.forEach(function (t) { rail.appendChild(t.el); });

    // Scroll length scales with the story so pacing stays constant.
    stage.style.height = Math.round(TIMELINE.length * 4.5) + "vh";

    if (addBtn) {
      var full = SOLUTIONS.length >= MAX_SOLUTIONS;
      addBtn.disabled = full;
      addBtn.querySelector(".add-label").textContent = full ? "Ecosystem full" : "Add solution";
    }
    lastDrawn = -1; // content changed under the current scroll position
  }

  /* ---------- New-solution popup ---------- */

  var modal = document.getElementById("solutionModal");
  var modalForm = document.getElementById("modalForm");
  var inpKey = document.getElementById("inpKey");
  var inpTitle = document.getElementById("inpTitle");
  var inpBody = document.getElementById("inpBody");
  var suggestionOpen = false; // modal was prefilled from the backlog

  function openModal() {
    if (SOLUTIONS.length >= MAX_SOLUTIONS) return;
    var s = BACKLOG.length ? BACKLOG[0] : null;
    suggestionOpen = !!s;
    inpKey.value = s ? s.key : "";
    inpTitle.value = s ? s.title : "";
    inpBody.value = s ? s.body : "";
    modal.hidden = false;
    requestAnimationFrame(function () {
      modal.classList.add("is-open");
      inpTitle.focus();
      inpTitle.select();
    });
  }

  function closeModal() {
    modal.classList.remove("is-open");
    setTimeout(function () { modal.hidden = true; }, 260);
  }

  function scrollToProgress(p) {
    var top = stage.offsetTop + p * (stage.offsetHeight - window.innerHeight);
    window.scrollTo({ top: top, behavior: "smooth" });
  }

  function solutionMid(r) {
    return (r.range.start + (r.range.end - r.range.start) * 0.5) / (TIMELINE.length - 1);
  }

  function scrollToSolution(i) {
    if (storyRanges[i]) scrollToProgress(solutionMid(storyRanges[i]));
  }

  // Arrow keys step through the story: seed → each solution card → bloom.
  // Up progresses, down regresses.
  document.addEventListener("keydown", function (e) {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    if (modal && !modal.hidden) return; // don't hijack keys inside the popup
    e.preventDefault();
    var pts = [0].concat(storyRanges.map(solutionMid)).concat([1]);
    var eps = 0.015;
    if (e.key === "ArrowUp") {
      for (var i = 0; i < pts.length; i++) {
        if (pts[i] > progress + eps) { scrollToProgress(pts[i]); return; }
      }
    } else {
      for (var j = pts.length - 1; j >= 0; j--) {
        if (pts[j] < progress - eps) { scrollToProgress(pts[j]); return; }
      }
    }
  });

  if (addBtn) {
    addBtn.addEventListener("click", openModal);
    modal.addEventListener("click", function (e) {
      if (e.target.hasAttribute("data-close")) closeModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !modal.hidden) closeModal();
    });
    modalForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (SOLUTIONS.length >= MAX_SOLUTIONS) { closeModal(); return; }
      SOLUTIONS.push({
        key: (inpKey.value.trim() || "New").slice(0, 12),
        title: inpTitle.value.trim() || "Your Next Solution",
        body: inpBody.value.trim() || "A fresh idea takes root. Swap in the name, story and impact of the next solution your ecosystem grows."
      });
      if (suggestionOpen) BACKLOG.shift(); // that suggestion's slot is used
      buildStory();
      closeModal();
      scrollToSolution(SOLUTIONS.length - 1); // ride down to watch the new leaf grow
    });
  }

  /* ---------- Frame preloading ---------- */

  var frames = new Array(FRAME_COUNT);
  var loadedCount = 0;
  var started = false;

  loader.classList.add("is-active");

  function onFrameSettled() {
    loadedCount++;
    var pct = Math.round((loadedCount / FRAME_COUNT) * 100);
    loaderFill.style.width = pct + "%";
    loaderPct.textContent = pct + "%";
    if (loadedCount >= FRAME_COUNT) start();
  }

  for (var i = 1; i <= FRAME_COUNT; i++) {
    (function (idx) {
      var img = new Image();
      img.decoding = "async";
      img.onload = function () {
        frames[idx - 1] = img;
        onFrameSettled();
      };
      img.onerror = onFrameSettled; // keep the show going; nearest frame fills in
      img.src = FRAME_PATH(idx);
    })(i);
  }

  // Safety valve: if the network stalls, start with whatever we have.
  setTimeout(function () { start(); }, 12000);

  /* ---------- Canvas sizing & drawing ---------- */

  var dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    lastDrawn = -1; // force redraw at the new size
  }

  function nearestFrame(idx) {
    // Prefer the exact frame; otherwise walk outward for a loaded neighbour.
    if (frames[idx]) return frames[idx];
    for (var d = 1; d < FRAME_COUNT; d++) {
      if (frames[idx - d]) return frames[idx - d];
      if (frames[idx + d]) return frames[idx + d];
    }
    return null;
  }

  function drawCover(img, alpha) {
    var cw = canvas.width, ch = canvas.height;
    var iw = img.naturalWidth, ih = img.naturalHeight;
    var scale = Math.max(cw / iw, ch / ih); // cover; the stalk is centred
    var dw = iw * scale, dh = ih * scale;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
  }

  function draw(step) {
    // Cross-fade the two steps around the fractional index so scrubbing
    // interpolates smoothly (and dissolves across segment seams).
    var a = Math.max(0, Math.min(TIMELINE.length - 1, Math.floor(step)));
    var b = Math.min(a + 1, TIMELINE.length - 1);
    var frac = step - a;
    var imgA = nearestFrame(TIMELINE[a]);
    if (!imgA) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    drawCover(imgA, 1);
    var imgB = frames[TIMELINE[b]];
    if (imgB && b !== a && frac > 0.01) drawCover(imgB, frac);
    ctx.globalAlpha = 1;
  }

  /* ---------- Scroll progress & render loop ---------- */

  var progress = 0;        // 0..1 through the pinned stage
  var renderedFrame = 0;   // eased, fractional step index
  var lastDrawn = -1;

  function readProgress() {
    var rect = stage.getBoundingClientRect();
    var total = rect.height - window.innerHeight;
    if (total <= 0) { progress = 0; return; }
    progress = Math.min(1, Math.max(0, -rect.top / total));
  }

  function fadeAt(p, a, b) {
    // 0 outside [a,b]; eased 0→1→0 across the entry/exit edges inside.
    // Ranges touching the stage boundaries skip that edge, so the intro
    // caption is visible at p=0 and the finale holds through p=1.
    if (p < a || p > b) return 0;
    var edge = Math.min(0.05, (b - a) / 3);
    var t = 1;
    if (a > 0 && p < a + edge) t = (p - a) / edge;
    else if (b < 1 && p > b - edge) t = (b - p) / edge;
    return t * t * (3 - 2 * t); // smoothstep
  }

  function updateOverlays() {
    // Key overlays to the frame actually rendered (renderedFrame lags the
    // scroll position while easing), so cards stay in sync with their leaf
    // even during fast scrolls.
    var effP = TIMELINE.length > 1 ? renderedFrame / (TIMELINE.length - 1) : 0;
    overlays.forEach(function (o) {
      var t = fadeAt(effP, o.start, o.end);
      o.el.style.opacity = t.toFixed(3);
      o.el.style.setProperty("--card-shift", ((1 - t) * 26).toFixed(1) + "px");
      var vis = t > 0.35;
      if (vis !== o.visible) {
        o.visible = vis;
        o.el.classList.toggle("is-visible", vis);
      }
    });
    ticks.forEach(function (t) {
      t.el.classList.toggle("active", effP >= t.at - 0.005);
    });
  }

  function loop() {
    readProgress();

    var target = progress * (TIMELINE.length - 1);
    // Ease toward the target so scrubbing feels fluid both directions,
    // settling exactly once the remaining distance is imperceptible.
    renderedFrame += (target - renderedFrame) * 0.12;
    if (Math.abs(target - renderedFrame) < 0.02) renderedFrame = target;

    if (Math.abs(renderedFrame - lastDrawn) > 0.004) {
      draw(renderedFrame);
      lastDrawn = renderedFrame;
    }

    updateOverlays();
    requestAnimationFrame(loop);
  }

  function start() {
    if (started) return;
    started = true;
    resize();
    draw(0);
    loader.classList.add("is-done");
    setTimeout(function () { loader.classList.remove("is-active"); }, 600);
    requestAnimationFrame(loop);
  }

  buildStory();
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", resize);
})();
