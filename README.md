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

## Retiming the story

Card timings live on the elements in `index.html` (`data-in` / `data-out`, both 0–1 across
the stage). At 16 fps, video time `t` maps to progress `p = t / 10` and frame
`n = round(t × 16) + 1`.

## Regenerating frames

```bash
ffmpeg -i beanstalk.mp4 -vf "fps=16,scale=1280:720" \
  -c:v libwebp -quality 72 -preset picture assets/frames/frame_%03d.webp
```

## Design language

Follows the EKL × Merkle *AI Re-Imagination Summit* light design system: grainy lime→teal
gradients, Archivo display type, Inter body, near-black ink, teal signal accents, the
✦ sparkle-in-a-circle mark, thin rule eyebrows, and glass cards on gradient.
