/* ============================================================
   From Seed to Ecosystem — scroll-scrubbed beanstalk stage
   - Preloads the WebP frame sequence, draws to canvas
   - Maps scroll progress of the pinned stage to frame index
   - Eases the frame index for smooth forward/backward scrub
   - Fades solution cards in/out at their growth milestones
   - Falls back to the static storyboard for reduced motion,
     missing canvas support, or JS disabled (noscript path)
   ============================================================ */

(function () {
  "use strict";

  var FRAME_COUNT = 160;
  var FRAME_PATH = function (i) {
    return "assets/frames/frame_" + String(i).padStart(3, "0") + ".webp";
  };

  // Virtual playback timeline (0-indexed source frames). The source video
  // grows one extra left curl before the bud; we replay that curl segment
  // mirrored to grow a matching extra right leaf, so the story becomes:
  // seed → left leaf → right leaf → left leaf 2 → right leaf 2 → bud → bloom.
  var SEGMENTS = [
    { from: 0,   to: 112, flip: false }, // seed → sprout → leaf L → leaf R → leaf L2
    { from: 96,  to: 113, flip: true  }, // curl segment mirrored → leaf R2
    { from: 112, to: 159, flip: false }  // bud → bloom
  ];
  var TIMELINE = [];
  SEGMENTS.forEach(function (s) {
    for (var f = s.from; f <= s.to; f++) TIMELINE.push({ idx: f, flip: s.flip });
  });
  var STEP_COUNT = TIMELINE.length; // virtual frames driven by scroll

  var prefersReduced = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var canvas = document.getElementById("growthCanvas");
  var ctx = canvas && canvas.getContext ? canvas.getContext("2d") : null;

  var scrubSupported = !!(ctx && "requestAnimationFrame" in window);

  // Static storyboard stays visible unless we can (and should) scrub.
  if (prefersReduced || !scrubSupported) return;

  document.documentElement.classList.add("scrub-on");

  var stage = document.getElementById("stage");
  var loader = document.getElementById("loader");
  var loaderFill = document.getElementById("loaderFill");
  var loaderPct = document.getElementById("loaderPct");

  var overlays = Array.prototype.slice.call(
    stage.querySelectorAll("[data-in]")
  ).map(function (el) {
    return {
      el: el,
      start: parseFloat(el.getAttribute("data-in")),
      end: parseFloat(el.getAttribute("data-out")),
      visible: false
    };
  });

  var ticks = Array.prototype.slice.call(stage.querySelectorAll(".rail-tick"));
  ticks.forEach(function (tick) {
    tick.style.top = (parseFloat(tick.getAttribute("data-at")) * 100) + "%";
  });

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

  function drawCover(img, alpha, flip) {
    var cw = canvas.width, ch = canvas.height;
    var iw = img.naturalWidth, ih = img.naturalHeight;
    var scale = Math.max(cw / iw, ch / ih); // cover; the stalk is centred
    var dw = iw * scale, dh = ih * scale;
    ctx.globalAlpha = alpha;
    if (flip) {
      ctx.save();
      ctx.translate(cw, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
      ctx.restore();
    } else {
      ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    }
  }

  function draw(step) {
    // Cross-fade the two timeline steps around the fractional index so
    // scrubbing interpolates smoothly (and dissolves across segment seams).
    var a = Math.max(0, Math.min(STEP_COUNT - 1, Math.floor(step)));
    var b = Math.min(a + 1, STEP_COUNT - 1);
    var frac = step - a;
    var entryA = TIMELINE[a], entryB = TIMELINE[b];
    var imgA = nearestFrame(entryA.idx);
    if (!imgA) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    drawCover(imgA, 1, entryA.flip);
    var imgB = frames[entryB.idx];
    if (imgB && b !== a && frac > 0.01) drawCover(imgB, frac, entryB.flip);
    ctx.globalAlpha = 1;
  }

  /* ---------- Scroll progress & render loop ---------- */

  var progress = 0;        // 0..1 through the pinned stage
  var renderedFrame = 0;   // eased, fractional frame index
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
    overlays.forEach(function (o) {
      var t = fadeAt(progress, o.start, o.end);
      o.el.style.opacity = t.toFixed(3);
      o.el.style.setProperty("--card-shift", ((1 - t) * 26).toFixed(1) + "px");
      var vis = t > 0.35;
      if (vis !== o.visible) {
        o.visible = vis;
        o.el.classList.toggle("is-visible", vis);
      }
    });
    ticks.forEach(function (tick) {
      var at = parseFloat(tick.getAttribute("data-at"));
      tick.classList.toggle("active", progress >= at - 0.005);
    });
  }

  function loop() {
    readProgress();

    var target = progress * (STEP_COUNT - 1);
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

  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", resize);
})();
