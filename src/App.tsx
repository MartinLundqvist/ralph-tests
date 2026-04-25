import React, { useState, useEffect, useRef } from 'react'

type Page = 'home' | 'loop'

const STEPS = [
  {
    abbr: 'READ', full: 'Read',
    desc: 'Ingests the task brief, environment state, and tool manifests into context. Loads all working-tree files referenced by the objective.',
    code: 'ralph read --dir . --task task.json',
  },
  {
    abbr: 'PLAN', full: 'Plan',
    desc: 'Decomposes the objective into a sequenced, dependency-resolved action graph. Assigns tools and estimates token cost per sub-step.',
    code: 'ralph plan --goal "ship feature" --emit plan.md',
  },
  {
    abbr: 'CODE', full: 'Code',
    desc: 'Writes, edits, and deletes source files to fulfil the current plan node. Invokes read, write, and bash tools as required.',
    code: 'ralph code --plan plan.md --apply',
  },
  {
    abbr: 'TEST', full: 'Test',
    desc: 'Executes the configured test runner and captures stdout, stderr, and exit code. Retries failing assertions up to the set limit.',
    code: 'ralph test --run "npm test" --retry 3',
  },
  {
    abbr: 'SAVE', full: 'Save',
    desc: 'Commits changed files to the working tree at the current HEAD. Stages only modified paths; never touches untracked work.',
    code: 'ralph save --files "*.ts" --msg "feat: step impl"',
  },
  {
    abbr: 'LOG',  full: 'Log',
    desc: 'Appends a structured trace entry to the persistent agent journal. Records step outcome, wall-clock duration, and token spend.',
    code: 'ralph log --step 6 --status ok --tokens 1240',
  },
  {
    abbr: 'CHK',  full: 'Check',
    desc: 'Evaluates the exit condition against the current working-tree state. Routes back to LOOP if unmet, or terminates the run if done.',
    code: 'ralph check --exit-condition "all tests green"',
  },
  {
    abbr: 'LOOP', full: 'Loop',
    desc: 'Resets the iteration counter and re-enters the cycle at READ. Carries forward all persistent state from the completed cycle.',
    code: 'ralph loop --next read --carry-state session.json',
  },
]

const RUNTIME_CONTEXT = [
  {
    label: 'SANDBOX',
    value: 'docker/0x17f3a2',
    detail: 'Isolated container with read/write access to the working tree. No network egress without explicit flag.',
  },
  {
    label: 'SIGNAL',
    value: 'NOMINAL',
    detail: 'Current signal received from the host environment. Escalates to ABORT on unrecoverable tool error.',
  },
  {
    label: 'STATE',
    value: 'session.json',
    detail: 'Persistent JSON blob written after every LOG step. Survives restarts and carries context forward.',
  },
  {
    label: 'ITERATIONS',
    value: '∞ / BOUNDED',
    detail: 'Loops until the exit condition is met or the iteration ceiling is reached. Default ceiling: 20.',
  },
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

interface StepGridProps {
  activeStep: number
}

function StepGrid({ activeStep }: StepGridProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  function handleCopy(index: number, code: string) {
    if (!navigator.clipboard) return
    navigator.clipboard.writeText(code).then(() => {
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 1500)
    }).catch(() => {})
  }

  return (
    <section className="step-grid-section">
      <div className="section-heading">
        <span>LOOP STEPS</span>
        <div className="section-divider" aria-hidden="true" />
      </div>
      <div className="step-grid">
        {STEPS.map((step, i) => (
          <div key={i} className={`step-card${i === activeStep ? ' step-card-active' : ''}`}>
            <span className="step-card-num">{String(i + 1).padStart(2, '0')}</span>
            <span className="step-card-name">{step.full.toUpperCase()}</span>
            <p className="step-card-desc">{step.desc}</p>
            <div
              className="step-code-wrap"
              onClick={() => handleCopy(i, step.code)}
              role="button"
              tabIndex={0}
              aria-label={`Copy command: ${step.code}`}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCopy(i, step.code) }}
            >
              <pre className="step-card-code"><code>{step.code}</code></pre>
              {copiedIndex === i && (
                <div className="step-copied-overlay" aria-live="polite">COPIED ✓</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function RuntimeContext() {
  return (
    <section className="runtime-section">
      <div className="section-heading">
        <span>RUNTIME CONTEXT</span>
        <div className="section-divider" aria-hidden="true" />
      </div>
      <div className="runtime-grid">
        {RUNTIME_CONTEXT.map((item) => (
          <div key={item.label} className="runtime-card">
            <span className="runtime-label">{item.label}</span>
            <span className="runtime-value">{item.value}</span>
            <p className="runtime-detail">{item.detail}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

interface LoopPageProps {
  onNavigate: () => void
  exiting: boolean
}

function LoopPage({ onNavigate, exiting }: LoopPageProps) {
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'auto'
    return () => { document.body.style.overflow = prev }
  }, [])

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

      <StepGrid activeStep={activeStep} />
      <RuntimeContext />

      <footer className="loop-footer">
        ▸ ralph-loop<span className="blink-cursor">_</span>
      </footer>
    </div>
  )
}

const PAGE_TITLES: Record<Page, string> = {
  home: 'RALPH',
  loop: 'RALPH — LOOP ARCHITECTURE',
}

export default function App() {
  const [page, setPage] = useState<Page>(getInitialPage)
  const [exiting, setExiting] = useState(false)
  const navigatingRef = useRef(false)

  useEffect(() => {
    document.title = PAGE_TITLES[page]
  }, [page])

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

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (page === 'home' && event.key.toLowerCase() === 'l') navigate('loop')
      else if (page === 'loop' && event.key === 'Escape') navigate('home')
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

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
