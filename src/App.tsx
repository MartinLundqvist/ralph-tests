import React from 'react'

interface SplitTextProps {
  text: string
}

function SplitText({ text }: SplitTextProps) {
  return (
    <span aria-label={text}>
      {text.split('').map((char, i) => (
        <span
          key={i}
          className="char"
          style={{ '--i': i } as React.CSSProperties}
          aria-hidden="true"
        >
          {char === ' ' ? ' ' : char}
        </span>
      ))}
    </span>
  )
}

export default function App() {
  return (
    <>
      <svg className="noise-overlay" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="noise-filter">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#noise-filter)" />
      </svg>

      <div className="corner corner-tl" aria-hidden="true" />
      <div className="corner corner-tr" aria-hidden="true" />
      <div className="corner corner-bl" aria-hidden="true" />
      <div className="corner corner-br" aria-hidden="true" />

      <main>
        <div className="bg-bloom" aria-hidden="true" />

        <div className="rings" aria-hidden="true">
          <div className="ring ring-inner" />
          <div className="ring ring-middle" />
          <div className="ring ring-outer" />
        </div>

        <div className="content">
          <div className="status-badge" aria-label="Loop active status">
            <span className="status-dot" aria-hidden="true">●</span>
            <span>LOOP ACTIVE</span>
          </div>

          <h1 className="title">
            <SplitText text="I AM RALPH" />
          </h1>

          <p className="subtitle">the agent loop</p>

          <div className="cursor" aria-hidden="true">
            ▸ <span className="blink-cursor">_</span>
          </div>
        </div>
      </main>
    </>
  )
}
