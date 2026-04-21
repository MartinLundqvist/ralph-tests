import React, { useState, useEffect, useRef } from 'react'

type Page = 'home' | 'loop'

const STEPS = [
  { abbr: 'READ', full: 'Read'  },
  { abbr: 'PLAN', full: 'Plan'  },
  { abbr: 'CODE', full: 'Code'  },
  { abbr: 'TEST', full: 'Test'  },
  { abbr: 'SAVE', full: 'Save'  },
  { abbr: 'LOG',  full: 'Log'   },
  { abbr: 'CHK',  full: 'Check' },
  { abbr: 'LOOP', full: 'Loop'  },
]

const ORBIT_R = 152
const LABEL_R = 196
const CX = 240
const CY = 240
const REVOLUTION_MS = 10_000

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

interface LoopDiagramProps {
  onActiveStepChange: (step: number) => void
}

function LoopDiagram({ onActiveStepChange }: LoopDiagramProps) {
  const [dotAngle, setDotAngle] = useState(-Math.PI / 2)
  const [trailAngles, setTrailAngles] = useState<[number, number, number]>(
    [-Math.PI / 2, -Math.PI / 2, -Math.PI / 2]
  )
  const [activeNode, setActiveNode] = useState(0)

  const startRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const activeNodeRef = useRef(0)
  const onChangeRef = useRef(onActiveStepChange)

  useEffect(() => {
    onChangeRef.current = onActiveStepChange
  })

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    function tick(ts: number) {
      if (startRef.current === null) startRef.current = ts
      const elapsed = ts - startRef.current
      const progress = (elapsed % REVOLUTION_MS) / REVOLUTION_MS
      const angle = progress * 2 * Math.PI - Math.PI / 2

      setDotAngle(angle)
      setTrailAngles([angle - 0.2, angle - 0.4, angle - 0.6])

      const norm = ((angle + Math.PI / 2) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)
      const nodeIdx = Math.round(norm / ((2 * Math.PI) / STEPS.length)) % STEPS.length

      if (nodeIdx !== activeNodeRef.current) {
        activeNodeRef.current = nodeIdx
        setActiveNode(nodeIdx)
        onChangeRef.current(nodeIdx)
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const dotX = CX + ORBIT_R * Math.cos(dotAngle)
  const dotY = CY + ORBIT_R * Math.sin(dotAngle)

  const trailDots = trailAngles.map((a, i) => ({
    x: CX + ORBIT_R * Math.cos(a),
    y: CY + ORBIT_R * Math.sin(a),
    opacity: 0.55 - i * 0.15,
    r: 5 - i,
  }))

  return (
    <div className="loop-diagram-wrap">
      <svg
        viewBox="0 0 480 480"
        className="loop-diagram"
        role="img"
        aria-label="Ralph agent loop diagram — animated pulse dot cycles through 8 steps"
      >
        {/* Outer decorative ring */}
        <circle cx={CX} cy={CY} r={216} fill="none" stroke="var(--phosphor-dim)" strokeWidth="1" />

        {/* Dashed orbit ring at radius 152 */}
        <circle
          cx={CX} cy={CY} r={ORBIT_R}
          fill="none"
          stroke="var(--phosphor-dim)"
          strokeWidth="1"
          strokeDasharray="4 8"
        />

        {/* Centre emblem */}
        <circle cx={CX} cy={CY} r={52} fill="none" stroke="var(--phosphor-dim)" strokeWidth="1" />
        <text x={CX} y={CY - 8} className="loop-emblem-title" textAnchor="middle" dominantBaseline="middle">RALPH</text>
        <text x={CX} y={CY + 8} className="loop-emblem-sub" textAnchor="middle" dominantBaseline="middle">AGENT</text>

        {/* 8 nodes */}
        {STEPS.map((step, i) => {
          const angle = (i / STEPS.length) * 2 * Math.PI - Math.PI / 2
          const nx = CX + ORBIT_R * Math.cos(angle)
          const ny = CY + ORBIT_R * Math.sin(angle)
          const lx = CX + LABEL_R * Math.cos(angle)
          const ly = CY + LABEL_R * Math.sin(angle)
          const isActive = i === activeNode

          return (
            <g key={i}>
              {/* Radial glow when active */}
              {isActive && (
                <circle
                  cx={nx} cy={ny} r={18}
                  fill="var(--phosphor-dim)"
                  style={{ filter: 'blur(6px)' }}
                />
              )}
              {/* Node circle */}
              <circle
                cx={nx} cy={ny}
                r={isActive ? 9 : 7}
                fill={isActive ? 'var(--phosphor)' : 'var(--bg-surface)'}
                stroke={isActive ? 'var(--phosphor)' : 'var(--text-secondary)'}
                strokeWidth={isActive ? 2 : 1}
                style={isActive ? { filter: 'drop-shadow(0 0 6px var(--phosphor))' } : undefined}
              />
              {/* Abbreviation + step number at radius 196 */}
              <text
                x={lx} y={ly - 8}
                className={`loop-node-abbr${isActive ? ' loop-node-abbr-active' : ''}`}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {step.abbr}
              </text>
              <text
                x={lx} y={ly + 8}
                className="loop-node-num"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {String(i + 1).padStart(2, '0')}
              </text>
            </g>
          )
        })}

        {/* Comet trail (3 points, decreasing opacity + radius) */}
        {trailDots.map((pt, i) => (
          <circle key={i} cx={pt.x} cy={pt.y} r={pt.r} fill="var(--phosphor)" opacity={pt.opacity} />
        ))}

        {/* Pulse dot */}
        <circle
          cx={dotX} cy={dotY} r={7}
          fill="var(--phosphor)"
          style={{ filter: 'drop-shadow(0 0 10px var(--phosphor))' }}
        />
      </svg>

      {/* Active-step text indicator */}
      <div className="loop-step-indicator" aria-live="polite" aria-atomic="true">
        <span className="loop-step-num">{String(activeNode + 1).padStart(2, '0')}</span>
        <span className="loop-step-sep"> — </span>
        <span className="loop-step-name">{STEPS[activeNode].full.toUpperCase()}</span>
      </div>
    </div>
  )
}

interface LoopPageProps {
  onNavigate: () => void
  exiting: boolean
}

function LoopPage({ onNavigate, exiting }: LoopPageProps) {
  const [activeStep, setActiveStep] = useState(0)

  return (
    <div className={`loop-page${exiting ? ' page-exit' : ''}`} data-active-step={activeStep}>
      <nav className="loop-nav">
        <button className="loop-nav-home" onClick={onNavigate}>← HOME</button>
        <span className="loop-nav-wordmark">RALPH</span>
      </nav>

      <section className="loop-hero">
        <p className="loop-tag">TECHNICAL ARCHITECTURE</p>
        <h1 className="loop-heading">THE LOOP</h1>
        <p className="loop-subtitle">the persistent cognition cycle</p>
        <LoopDiagram onActiveStepChange={setActiveStep} />
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
