import React, { useState, useEffect, useRef } from 'react'

type Page = 'home' | 'loop'

function getInitialPage(): Page {
  return window.location.hash === '#loop' ? 'loop' : 'home'
}

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

interface HomePageProps {
  onNavigate: () => void
  exiting: boolean
}

function HomePage({ onNavigate, exiting }: HomePageProps) {
  return (
    <div className={`home-page${exiting ? ' page-exit' : ''}`}>
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

          <button className="loop-btn" onClick={onNavigate}>
            LOOP ARCHITECTURE ↗
          </button>
        </div>
      </main>
    </div>
  )
}

interface LoopPageProps {
  onNavigate: () => void
  exiting: boolean
}

function LoopPage({ onNavigate, exiting }: LoopPageProps) {
  return (
    <div className={`loop-page${exiting ? ' page-exit' : ''}`}>
      <nav className="loop-nav">
        <button className="loop-nav-home" onClick={onNavigate}>← HOME</button>
        <span className="loop-nav-wordmark">RALPH</span>
      </nav>

      <section className="loop-hero">
        <p className="loop-tag">TECHNICAL ARCHITECTURE</p>
        <h1 className="loop-heading">THE LOOP</h1>
        <p className="loop-subtitle">the persistent cognition cycle</p>
      </section>

      <footer className="loop-footer">
        ▸ ralph-loop<span className="blink-cursor">_</span>
      </footer>
    </div>
  )
}

export default function App() {
  const [page, setPage] = useState<Page>(getInitialPage)
  const [exiting, setExiting] = useState(false)
  const navigatingRef = useRef(false)

  useEffect(() => {
    function handleHashChange() {
      if (!navigatingRef.current) {
        setPage(window.location.hash === '#loop' ? 'loop' : 'home')
      }
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  function navigate(to: Page) {
    navigatingRef.current = true
    setExiting(true)
    setTimeout(() => {
      window.location.hash = to === 'loop' ? '#loop' : ''
      setPage(to)
      setExiting(false)
      setTimeout(() => { navigatingRef.current = false }, 0)
    }, 300)
  }

  if (page === 'loop') {
    return (
      <LoopPage
        onNavigate={() => navigate('home')}
        exiting={exiting}
      />
    )
  }

  return (
    <HomePage
      onNavigate={() => navigate('loop')}
      exiting={exiting}
    />
  )
}
