# PRD: Ralph Landing Page Visual Redesign

## Overview

Ralph is an AI agent loop. The landing page currently renders a single centered heading with no visual identity. This PRD defines the design and animation spec to transform it into a memorable, production-grade landing page that communicates Ralph's nature — a recursive, intelligent loop — through motion, type, and atmosphere.

---

## Aesthetic Direction

**Theme: Deep Terminal — Phosphor Pulse**

Inspired by vintage CRT terminals meeting modern deep-space UI. Dark, atmospheric, and technical without being generic "AI purple." The defining metaphor is the *loop itself* — orbiting particles, cycling glows, text that feels like it's being received rather than rendered.

- **Tone**: Quiet power. Industrial restraint. The page breathes.
- **The one thing people remember**: The three concentric rings slowly orbiting the title, each at a different speed, glowing like signal traces on an oscilloscope.

---

## Typography

| Role | Font | Source |
|---|---|---|
| Display / H1 | **DM Mono** (semibold 600) | Google Fonts |
| Subtitle / body | **Instrument Serif** (italic) | Google Fonts |
| Label / badge | **Space Mono** (regular 400) | Google Fonts |

Rationale: DM Mono gives the name machine authority. Instrument Serif italic in the subtitle creates a surprising organic contrast. Space Mono for small labels preserves the terminal feel at small sizes.

---

## Color Palette

```
--bg-void:        #080a0e   /* near-black with blue undertone */
--bg-surface:     #0d1117   /* subtle card/glass layer */
--phosphor:       #00ff9d   /* primary glow — phosphor green */
--phosphor-dim:   #00ff9d33 /* 20% alpha glow for rings */
--trace:          #1affb2   /* ring highlight, lighter */
--signal:         #ff6b35   /* accent — warm amber-orange */
--text-primary:   #e8f0ec   /* off-white, slightly warm */
--text-secondary: #6b8a7a   /* muted green-gray */
--grain:          url(#noise) /* SVG feTurbulence grain overlay */
```

No purple. No blue-to-purple gradients. The phosphor green and burnt orange are unexpected together and immediately memorable.

---

## Layout

Single full-viewport section. No scroll. Everything composited in the center third vertically, but the orbital rings bleed to the viewport edges.

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│          [STATUS BADGE — "LOOP ACTIVE"]             │
│                                                     │
│    ◯ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ◯      │
│   ╱                                         ╲      │
│  ◯   ╔═══════════════════════════════╗       ◯     │
│  │   ║        I AM RALPH             ║       │     │
│  │   ║   the agent loop              ║       │     │
│  ◯   ╚═══════════════════════════════╝       ◯     │
│   ╲                                         ╱      │
│    ◯ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ◯      │
│                                                     │
│              [ cursor / CTA ]                       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

The three orbital rings (small, medium, large ellipses) are CSS-animated, rotated in 3D perspective to appear as tilted orbit planes.

---

## Components

### 1. Background

- `#080a0e` base color
- SVG `<feTurbulence>` noise texture overlaid at 4% opacity for grain/film feel
- Radial gradient from center: `rgba(0,255,157,0.06)` → transparent, creating a soft phosphor bloom behind the title
- No stars, no grid, no particles — the rings provide all the movement

### 2. Orbital Rings

Three `<div>` elements absolutely positioned, centered, styled as thin ellipses (`border: 1px solid var(--phosphor-dim)`).

| Ring | Width | Height | Animation duration | Direction |
|---|---|---|---|---|
| Inner | 320px | 180px | 8s | clockwise |
| Middle | 520px | 280px | 14s | counter-clockwise |
| Outer | 720px | 380px | 22s | clockwise |

All rings:
- `border-radius: 50%`
- `transform: rotateX(72deg)` — gives them the tilted orbital plane look
- `animation: spin linear infinite`
- Each ring has a single "satellite dot" — a `::after` pseudo-element (4px × 4px circle, `var(--phosphor)`, `box-shadow: 0 0 8px var(--phosphor)`) that travels along the ring path

The satellite dot uses `@keyframes` `rotate` on the ring's own axis, so the dot appears to orbit.

### 3. Status Badge

Small uppercase label above the title:

```
● LOOP ACTIVE
```

- Font: Space Mono 11px, letter-spacing 0.2em
- Color: `var(--signal)` (orange)
- The `●` pulses with a `@keyframes pulse` — opacity 1 → 0.3 → 1 on 2s infinite
- Fades in at `animation-delay: 0.3s` on page load

### 4. Title Block

```
I AM RALPH
the agent loop
```

**"I AM RALPH"**
- Font: DM Mono 600, `clamp(3rem, 8vw, 7rem)`
- Color: `var(--text-primary)`
- Letter-spacing: 0.04em
- Text-shadow: `0 0 40px rgba(0,255,157,0.25)` — faint phosphor bloom
- Reveal animation: characters slide up from `translateY(20px)` + `opacity: 0` → resting state, staggered per character using CSS custom property `--i` and `animation-delay: calc(var(--i) * 0.05s)`

**"the agent loop"**
- Font: Instrument Serif italic, `clamp(1.2rem, 3vw, 2rem)`
- Color: `var(--text-secondary)`
- Reveal: fades in at `animation-delay: 0.8s` after title completes

### 5. Cursor / CTA

Below the subtitle, a blinking terminal cursor line:

```
▸ _
```

- Space Mono, `var(--phosphor)`, font-size 1rem
- The underscore blinks: `opacity: 1 → 0` on 0.9s `steps(1)` infinite
- No actual link needed for this phase — it signals interactivity without committing to a flow

### 6. Corner Decorations (optional, low effort)

Four `position: absolute` corner marks — thin L-shaped 12×12px bracket shapes using `border-top` + `border-left` (and variants) in `var(--phosphor-dim)`. Pure CSS, no SVG required.

---

## Animation Sequence

All triggered on page load. No scroll dependency.

| t | Event |
|---|---|
| 0ms | Rings begin spinning (already in motion, no delay) |
| 100ms | Background radial bloom fades in (`opacity: 0 → 1`, 600ms ease) |
| 300ms | Status badge appears |
| 500ms | Title characters stagger in (each 50ms apart, ~600ms total) |
| 800ms | Subtitle fades in |
| 1100ms | Cursor appears + blink starts |

Total: fully composed by ~1.2s. No jank.

---

## Technical Implementation

- **Framework**: React + TypeScript (existing stack)
- **Styling**: CSS custom properties in `index.css`, component-scoped styles via CSS modules or a `<style>` block in `App.tsx` — no new dependencies
- **Fonts**: Loaded via `<link>` in `index.html` from Google Fonts (preconnect + display=swap)
- **Motion**: Pure CSS animations only — no library needed for this page
- **Character split for stagger**: Handled in a tiny `SplitText` React component that wraps each character in a `<span style={{ '--i': index }}>` — zero dependencies
- **Accessibility**: `prefers-reduced-motion` media query disables all animations and removes text-shadow glow. Title is a semantic `<h1>`. Aria-label on status badge.

---

## Acceptance Criteria

- [ ] Page background is `#080a0e` with visible grain texture
- [ ] Three orbital rings visible, each tilted on the X axis, rotating at different speeds in alternating directions
- [ ] Each ring has a glowing satellite dot traveling its circumference
- [ ] Phosphor green (`#00ff9d`) is the dominant accent; burnt orange (`#ff6b35`) appears only on the status badge
- [ ] Title uses DM Mono; subtitle uses Instrument Serif italic
- [ ] Title characters animate in with stagger on page load (no jank at 60fps)
- [ ] Status badge pulses
- [ ] Blinking cursor present below subtitle
- [ ] `prefers-reduced-motion: reduce` disables all animations without breaking layout
- [ ] No external animation libraries added to `package.json`
- [ ] Renders correctly at 375px (mobile), 768px (tablet), 1440px (desktop)
- [ ] Lighthouse Performance score ≥ 95 on desktop

---

## Out of Scope

- Navigation, routing, or additional pages
- Dark/light mode toggle
- Interactive agent controls or status indicators fed by real data
- Any backend integration
