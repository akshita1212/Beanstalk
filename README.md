# From Seed to Ecosystem 🌱

A scroll-driven, immersive website for the **EKL × Merkle — AI Re-Imagination Summit 2026**.
The page opens directly on the enchanted seed, pinned full-screen. A magical beanstalk
grows as you scroll: the seed cracks, the stalk rises, buds branch left and right — each
one revealing an AI solution — and the story ends on the bloom: one intelligent ecosystem.

Static site, no build step. Open `index.html` from any web server:

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

## How it works

- **Frame-sequence scrubbing** — the source video was converted to 160 WebP frames
  (`assets/frames/`, 16 fps, ~2.5 MB total). All frames are preloaded behind a progress
  loader, then drawn to a full-viewport `<canvas>` inside a pinned (sticky) stage that
  spans 720 vh of scroll.
- **Smooth, bidirectional control** — scroll progress maps to a fractional frame index that
  is eased every animation frame (`renderedFrame += (target − rendered) × 0.16`), so
  scrubbing feels fluid up and down with no flicker.
- **Milestone-linked content** — each solution card carries `data-in` / `data-out` scroll
  ranges matched to the moment its bud or leaf grows in the footage. Cards fade and rise
  in, draw a teal connector line toward the stalk, and alternate left/right. A milestone
  rail on the left tracks Seed → Know → Serve → Reach → Grow → Bloom.
- **Accessibility & fallbacks** — with `prefers-reduced-motion`, missing canvas support, or
  JavaScript disabled, the pinned stage is replaced by a static storyboard (key frames +
  the same content in normal document flow). Mobile turns side cards into bottom sheets.

## Story templates & the add button

The source video is cut into four reusable segment templates, each starting and ending
on a bare stalk (`SEG` in `js/main.js`): seed (0–2s), left leaf (2–5s), right leaf
(5–8s), bloom (8–10s). The playback timeline is assembled per story: seed, then one
leaf segment per solution (alternating left/right), then bloom. Solutions live in the
`SOLUTIONS` array; the **+ Add solution** button appends the next entry from `BACKLOG`
(then generic placeholders, capped at 8), regenerates the cards, rail and finale copy,
and rescales the scroll length so pacing stays constant.

## Regenerating frames

```bash
ffmpeg -i beanstalk.mp4 -vf "fps=16,scale=1280:720" \
  -c:v libwebp -quality 72 -preset picture assets/frames/frame_%03d.webp
```

## Design language

Follows the EKL × Merkle *AI Re-Imagination Summit* light design system: grainy lime→teal
gradients, Archivo display type, Inter body, near-black ink, teal signal accents, the
✦ sparkle-in-a-circle mark, thin rule eyebrows, and glass cards on gradient.
