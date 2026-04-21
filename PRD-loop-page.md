# PRD: Ralph Loop Architecture Page

## Overview

Add a second page to the Ralph landing page that provides a technical deep-dive into the Ralph agent loop. A navigation button on the landing page routes users to this new page.

## Problem Statement

The current landing page communicates *what* Ralph is (an agent loop) through visual metaphor but provides no technical context on *how* the loop works. Developers and technically curious visitors have no path to understand the architecture.

## Goals

- Provide a clear, visually compelling technical explanation of the Ralph loop
- Maintain design cohesion with the existing "Deep Terminal Phosphor Pulse" aesthetic
- Add client-side navigation without a full page reload
- Introduce zero new npm dependencies (hash-based routing via native `hashchange` event)

## User Stories

1. As a developer visiting the landing page, I want a clear CTA to learn how Ralph works technically, so I can understand the agent architecture.
2. As a technical reader, I want to see the loop steps with code examples, so I can understand how to run or adapt Ralph.
3. As a visitor, I want to navigate back to the landing page easily using a back button or the browser back button.

## Technical Requirements

### Routing

- Hash-based SPA routing: `#loop` → loop page, no hash → home page
- Browser back/forward button support via `hashchange` event listener
- No new npm dependencies (no React Router)
- Page transition: 300ms exit fade on current page, 400ms enter fade on next page

### Landing Page Changes (`src/App.tsx`, `src/index.css`)

- Add an `LOOP ARCHITECTURE` button below the existing cursor CTA
- Style: terminal aesthetic — thin phosphor-green border, monospace font, hover glow
- Animation: `fade-in` with 1400ms delay (after the cursor at 1100ms)
- On click: animate out home, navigate to `#loop`

### Loop Architecture Page (`src/LoopPage.tsx`)

**Navigation bar**
- Left: `← HOME` button
- Right: `RALPH` wordmark

**Hero section**
- Tag: `TECHNICAL ARCHITECTURE`
- Title: `THE LOOP`
- Subtitle: one-line technical summary

**Loop diagram** (SVG, React-driven `requestAnimationFrame`)
- 480×480 viewBox, max-width 480px centered
- Dashed orbit ring at radius 152
- 8 evenly-spaced nodes on the ring; each shows a 4-5 char abbreviation
- Step number label at radius 196 outside each node
- Center emblem: `RALPH / AGENT`
- Animated phosphor-green pulse dot with 3-point comet trail
- Active node highlights as the dot passes through
- Pauses when `prefers-reduced-motion` is enabled

**Active step indicator** (below diagram)
- Shows current step number and full name as the dot travels

**Step grid**
- 2×4 grid on desktop, 1-column on mobile
- Each card: step number (large), full name, 2-line description, shell command in code block
- Active card highlights to match the diagram dot

**Runtime context section**
- 2×2 grid of architecture cards
- SANDBOX, SIGNAL, STATE, ITERATIONS

**Footer**
- Terminal prompt: `▸ ralph-loop_`

### Styling

- Extends existing CSS custom properties — no new design tokens
- Loop diagram: phosphor green nodes, active state with full-brightness border and glow
- Code blocks: `Space Mono` monospace, dark tinted background, left phosphor-green border
- `body { overflow: auto }` injected via `useEffect` when loop page is active, restored on unmount
- Responsive: mobile (1-col grid, scaled diagram), tablet, desktop

## UI / UX Specification

### Explore button (landing page)

```
[ LOOP ARCHITECTURE  ↗ ]
```

- `font-family: 'Space Mono'`, `font-size: 11px`, `letter-spacing: 0.2em`
- Border: `1px solid rgba(0,255,157,0.3)`, hover brightens to `var(--phosphor)`
- Hover: box-shadow glow, arrow nudge `translate(2px, -2px)`
- Centered below `.cursor`, `margin-top: 0.5rem`

### Loop page layout (top to bottom)

1. Nav bar — 60px
2. Hero section — ~180px
3. Loop diagram — 480px (scales on mobile)
4. Active step indicator — 48px
5. Step grid — 8 cards, 2-col
6. Runtime context — 4 cards, 2-col
7. Footer — 80px

## Acceptance Criteria

- [ ] Button appears on landing page and navigates to loop page without full reload
- [ ] Browser back button returns to landing page
- [ ] Loop diagram animates; dot travels full revolution in 10 seconds
- [ ] Active node and active step card highlight in sync with the dot
- [ ] All 8 steps are shown with descriptions and code examples
- [ ] Animations disabled when `prefers-reduced-motion: reduce`
- [ ] Page is responsive at 480px, 768px, and 1440px
- [ ] Lighthouse desktop score remains ≥ 95
- [ ] TypeScript: zero type errors (`pnpm run typecheck`)
- [ ] No new npm dependencies

## Out of Scope

- Live loop execution monitoring or real-time data
- Authentication or user accounts
- Dark / light mode toggle
- More than 2 pages total
- Animation library dependencies (keep pure CSS / SVG / rAF)
