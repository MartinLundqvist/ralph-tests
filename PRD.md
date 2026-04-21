# PRD: Ralph Landing Page

## Overview

A minimal single-page React application that displays the text "I am Ralph - the agent loop". Built with Vite, React, and TypeScript.

## Goals

- Ship the simplest possible working SPA
- No routing, no state management, no API calls
- Serve as a verified baseline for the project scaffold

## Out of Scope

- Authentication
- Backend / API
- Multiple routes or pages
- Animations or complex styling

---

## Tech Stack

| Layer     | Choice                        |
|-----------|-------------------------------|
| Bundler   | Vite 5.x                      |
| Framework | React 18.x                    |
| Language  | TypeScript (strict mode)      |
| Styles    | Plain CSS (no framework)      |
| Package   | pnpm (already configured)     |

---

## Project Structure

```
ralph-tests/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── package.json
└── src/
    ├── main.tsx          # React root mount
    ├── App.tsx           # Single component with the heading
    └── index.css         # Minimal reset + centering
```

---

## Implementation Steps

### 1. Install dependencies

```bash
pnpm add react react-dom
pnpm add -D vite @vitejs/plugin-react typescript @types/react @types/react-dom
```

### 2. `index.html`

Standard Vite HTML entry point. Mounts to `<div id="root">` and loads `src/main.tsx` as an ES module.

### 3. `vite.config.ts`

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

### 4. `tsconfig.json`

Strict TypeScript config targeting ESNext with `jsx: react-jsx`. References `tsconfig.node.json` for Vite config typechecking.

### 5. `src/main.tsx`

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

### 6. `src/App.tsx`

```tsx
export default function App() {
  return (
    <main>
      <h1>I am Ralph - the agent loop</h1>
    </main>
  )
}
```

### 7. `src/index.css`

Minimal reset that centers the heading vertically and horizontally on the viewport.

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: system-ui, sans-serif;
}

main {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

h1 {
  font-size: 2rem;
}
```

### 8. `package.json` scripts

Add to the existing `package.json`:

```json
"scripts": {
  "dev":   "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview"
}
```

---

## Acceptance Criteria

- [ ] `pnpm dev` starts the dev server without errors
- [ ] Browser at `localhost:5173` shows "I am Ralph - the agent loop" centered on the page
- [ ] `pnpm build` completes without TypeScript or bundler errors
- [ ] No console errors or warnings at runtime
