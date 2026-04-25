import React, { useState, useEffect, useRef } from 'react'

type Page = 'home' | 'loop' | 'afk'

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
  if (window.location.hash === '#loop') return 'loop'
  if (window.location.hash === '#afk') return 'afk'
  return 'home'
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
  const pausedRef = useRef(false)
  const pausedElapsedRef = useRef(0)

  useEffect(() => {
    onChangeRef.current = onActiveStepChange
  })

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    function tick(ts: number) {
      if (startRef.current === null) startRef.current = ts

      if (pausedRef.current) {
        startRef.current = ts - pausedElapsedRef.current
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      const elapsed = ts - startRef.current
      pausedElapsedRef.current = elapsed
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
        onMouseEnter={() => { pausedRef.current = true }}
        onMouseLeave={() => { pausedRef.current = false }}
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
  onNavigateAfk: () => void
  exiting: boolean
}

function LoopPage({ onNavigate, onNavigateAfk, exiting }: LoopPageProps) {
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

      <div className="loop-afk-cta">
        <button className="loop-btn" onClick={onNavigateAfk}>
          AFK SCRIPT ↗
        </button>
      </div>

      <footer className="loop-footer">
        ▸ ralph-loop<span className="blink-cursor">_</span>
      </footer>
    </div>
  )
}

interface AfkPageProps {
  onNavigate: () => void
  exiting: boolean
}

function AfkFlowDiagram() {
  const ph = '#00ff9d'
  const phd = '#00ff9d55'
  const phf = '#00ff9d0d'
  const bg = '#0d1117'
  const tp = '#e8f0ec'
  const ts = '#6b8a7a'
  const sig = '#ff6b35'

  return (
    <svg
      viewBox="0 0 540 710"
      style={{ width: '100%', maxWidth: '600px', display: 'block', margin: '0 auto' }}
      aria-label="afk-ralph.sh lifecycle flowchart"
      role="img"
    >
      <defs>
        <marker id="afk-arr" viewBox="0 0 10 10" refX="9" refY="5"
          markerWidth="5" markerHeight="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={phd} />
        </marker>
        <marker id="afk-arr-sig" viewBox="0 0 10 10" refX="9" refY="5"
          markerWidth="5" markerHeight="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={sig} />
        </marker>
        <marker id="afk-arr-ph" viewBox="0 0 10 10" refX="9" refY="5"
          markerWidth="5" markerHeight="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={ph} />
        </marker>
      </defs>

      {/* START pill */}
      <rect x={200} y={12} width={140} height={28} rx={14} fill={ph} />
      <text x={270} y={31} textAnchor="middle" fontFamily="'Space Mono', monospace"
        fontSize={13} fontWeight={700} fill={bg}>START</text>

      {/* Arrow: START → outer loop box */}
      <line x1={270} y1={40} x2={270} y2={57} stroke={phd} strokeWidth={1.5}
        markerEnd="url(#afk-arr)" />

      {/* OUTER LOOP dashed box: x=14, y=58, w=498, h=588, right=512, bottom=646 */}
      <rect x={14} y={58} width={498} height={588} fill="none" stroke={phd}
        strokeWidth={1} strokeDasharray="8 4" rx={3} />
      <text x={20} y={53} fontFamily="'Space Mono', monospace" fontSize={11}
        letterSpacing="0.2em" fill={ts}>1 .. N iterations</text>

      {/* find_next_issue sub-box: x=26, y=68, w=474, h=148 */}
      <rect x={26} y={68} width={474} height={148} fill={phf} stroke={phd}
        strokeWidth={1} rx={3} />
      <text x={38} y={88} fontFamily="'Space Mono', monospace" fontSize={13}
        fontWeight={700} fill={ph}>find_next_issue()</text>
      <text x={52} y={106} fontFamily="'Space Mono', monospace" fontSize={11} fill={ts}>
        {'gh issue list --state open --label grindable --json number | sort'}
      </text>
      <text x={52} y={122} fontFamily="'Space Mono', monospace" fontSize={11} fill={ts}>
        {'for each candidate {'}
      </text>
      <text x={66} y={138} fontFamily="'Space Mono', monospace" fontSize={11} fill={ts}>
        {'  parse "Blocked by #N" from body'}
      </text>
      <text x={66} y={154} fontFamily="'Space Mono', monospace" fontSize={11} fill={ts}>
        {'  gh issue view <blocker> --json state'}
      </text>
      <text x={66} y={170} fontFamily="'Space Mono', monospace" fontSize={11} fill={sig}>
        {'  if OPEN → skip (continue)   ·   if exhausted → EXIT 0'}
      </text>
      <text x={52} y={186} fontFamily="'Space Mono', monospace" fontSize={11} fill={ts}>
        {'} → return issue_number'}
      </text>

      {/* Arrow: find_next_issue → fetch details */}
      <line x1={270} y1={216} x2={270} y2={234} stroke={phd} strokeWidth={1.5}
        markerEnd="url(#afk-arr)" />
      <text x={278} y={228} fontFamily="'Space Mono', monospace" fontSize={10} fill={ph}>
        issue found
      </text>

      {/* FETCH DETAILS rect: y=236 to 294 */}
      <rect x={74} y={236} width={392} height={58} fill={bg} stroke={phd}
        strokeWidth={1} rx={3} />
      <text x={270} y={256} textAnchor="middle" fontFamily="'Space Mono', monospace"
        fontSize={12} fontWeight={600} fill={tp}>Fetch issue details</text>
      <text x={270} y={271} textAnchor="middle" fontFamily="'Space Mono', monospace"
        fontSize={11} fill={ts}>
        {'gh issue view N --json title · body · comments'}
      </text>
      <text x={270} y={285} textAnchor="middle" fontFamily="'Space Mono', monospace"
        fontSize={11} fill={ts}>
        {'gh issue list --json number,title  (other open issues)'}
      </text>

      {/* Arrow */}
      <line x1={270} y1={294} x2={270} y2={312} stroke={phd} strokeWidth={1.5}
        markerEnd="url(#afk-arr)" />

      {/* WRITE CONTEXT FILE: y=314 to 352 */}
      <rect x={100} y={314} width={340} height={38} fill={bg} stroke={phd}
        strokeWidth={1} rx={3} />
      <text x={270} y={330} textAnchor="middle" fontFamily="'Space Mono', monospace"
        fontSize={12} fontWeight={600} fill={tp}>write .ralph-context.md</text>
      <text x={270} y={344} textAnchor="middle" fontFamily="'Space Mono', monospace"
        fontSize={11} fill={ts}>
        {'issue title · body · comments · other open issues'}
      </text>

      {/* Arrow */}
      <line x1={270} y1={352} x2={270} y2={370} stroke={phd} strokeWidth={1.5}
        markerEnd="url(#afk-arr)" />

      {/* INIT STATUS FILE: y=372 to 422 */}
      <rect x={74} y={372} width={392} height={50} fill={bg} stroke={phd}
        strokeWidth={1} rx={3} />
      <text x={270} y={390} textAnchor="middle" fontFamily="'Space Mono', monospace"
        fontSize={12} fontWeight={600} fill={tp}>init .ralph-status.json</text>
      <text x={270} y={406} textAnchor="middle" fontFamily="'Space Mono', monospace"
        fontSize={11} fill={ts}>
        {'{ "issue": N, "status": "in_progress", "summary": null }'}
      </text>

      {/* Arrow */}
      <line x1={270} y1={422} x2={270} y2={440} stroke={phd} strokeWidth={1.5}
        markerEnd="url(#afk-arr)" />

      {/* DOCKER INVOCATION (highlighted): y=442 to 498 */}
      <rect x={26} y={442} width={474} height={56} fill={phf} stroke={ph}
        strokeWidth={1.5} rx={3} />
      <text x={270} y={460} textAnchor="middle" fontFamily="'Space Mono', monospace"
        fontSize={12} fontWeight={700} fill={ph}>docker sandbox run claude --</text>
      <text x={270} y={476} textAnchor="middle" fontFamily="'Space Mono', monospace"
        fontSize={11} fill={ts}>
        {'--permission-mode acceptEdits -p "@.ralph-context.md [instructions]"'}
      </text>
      <text x={270} y={490} textAnchor="middle" fontFamily="'Space Mono', monospace"
        fontSize={11} fill={ts}>
        {'↳ agent implements issue, writes results back to .ralph-status.json'}
      </text>

      {/* Arrow */}
      <line x1={270} y1={498} x2={270} y2={516} stroke={phd} strokeWidth={1.5}
        markerEnd="url(#afk-arr)" />

      {/* POST-RUN DIAMOND: center (270,538), hw=84, hh=26 */}
      {/* points: top=512, right=354, bottom=564, left=186 */}
      <polygon points="270,512 354,538 270,564 186,538"
        fill={bg} stroke={sig} strokeWidth={1.5} />
      <text x={270} y={534} textAnchor="middle" fontFamily="'Space Mono', monospace"
        fontSize={11} fill={tp}>{'status == "complete"'}</text>
      <text x={270} y={548} textAnchor="middle" fontFamily="'Space Mono', monospace"
        fontSize={11} fill={tp}>{'&& issue == N ?'}</text>

      {/* YES branch: right from diamond */}
      <line x1={354} y1={538} x2={424} y2={538} stroke={sig} strokeWidth={1.5}
        markerEnd="url(#afk-arr-sig)" />
      <text x={386} y={532} textAnchor="middle" fontFamily="'Space Mono', monospace"
        fontSize={10} fill={sig}>YES</text>

      {/* gh comment + close box */}
      <rect x={426} y={524} width={86} height={28} fill={bg} stroke={sig}
        strokeWidth={1} rx={3} />
      <text x={469} y={535} textAnchor="middle" fontFamily="'Space Mono', monospace"
        fontSize={10} fill={sig}>gh comment</text>
      <text x={469} y={547} textAnchor="middle" fontFamily="'Space Mono', monospace"
        fontSize={10} fill={sig}>+ gh close</text>

      {/* YES path after close → down to y=606, left to merge with NO */}
      <path d="M 469 552 L 469 606 L 274 606"
        fill="none" stroke={sig} strokeWidth={1} strokeDasharray="4 3" />

      {/* NO branch: down from diamond */}
      <line x1={270} y1={564} x2={270} y2={606} stroke={phd} strokeWidth={1.5}
        markerEnd="url(#afk-arr)" />
      <text x={248} y={588} fontFamily="'Space Mono', monospace" fontSize={10} fill={ts}>NO</text>

      {/* "next iteration" label */}
      <text x={148} y={621} textAnchor="middle" fontFamily="'Space Mono', monospace"
        fontSize={10} fill={ts}>{'↺ next iteration'}</text>

      {/* Loop-back: left side up to find_next_issue */}
      <path d="M 270 606 L 26 606 L 26 88 L 28 88"
        fill="none" stroke={phd} strokeWidth={1} strokeDasharray="5 3"
        markerEnd="url(#afk-arr)" />

      {/* Cleanup arc: right side of outer loop box */}
      <path d="M 512 68 Q 526 360 512 646"
        fill="none" stroke={sig} strokeWidth={1} strokeDasharray="4 3" />
      <text x={528} y={360} textAnchor="middle" fontFamily="'Space Mono', monospace"
        fontSize={10} fill={sig} transform="rotate(90,528,360)">trap cleanup EXIT</text>
      <line x1={512} y1={646} x2={512} y2={656} stroke={sig} strokeWidth={1}
        markerEnd="url(#afk-arr-sig)" />

      {/* CLEANUP rect: below outer loop box */}
      <rect x={26} y={658} width={474} height={36} fill="none" stroke={sig}
        strokeWidth={1} strokeDasharray="4 3" rx={3} />
      <text x={270} y={673} textAnchor="middle" fontFamily="'Space Mono', monospace"
        fontSize={11} fontWeight={600} fill={sig}>cleanup</text>
      <text x={270} y={687} textAnchor="middle" fontFamily="'Space Mono', monospace"
        fontSize={11} fill={ts}>
        {'rm .ralph-context.md  ·  rm .ralph-status.json'}
      </text>
    </svg>
  )
}

function AfkStateMachine() {
  const ph = '#00ff9d'
  const phd = '#00ff9d55'
  const bg = '#0d1117'
  const tp = '#e8f0ec'
  const ts = '#6b8a7a'
  const sig = '#ff6b35'

  return (
    <div>
      <svg
        viewBox="0 0 460 140"
        style={{ width: '100%', display: 'block', marginBottom: '20px' }}
        aria-label="Status file state machine diagram"
        role="img"
      >
        <defs>
          <marker id="sm-arr" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="5" markerHeight="5" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={phd} />
          </marker>
          <marker id="sm-arr-sig" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="5" markerHeight="5" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={sig} />
          </marker>
        </defs>

        {/* in_progress box */}
        <rect x={150} y={14} width={160} height={40} rx={4} fill={bg}
          stroke={phd} strokeWidth={1} />
        <text x={230} y={33} textAnchor="middle" fontFamily="'Space Mono', monospace"
          fontSize={10} fill={tp}>in_progress</text>
        <text x={230} y={47} textAnchor="middle" fontFamily="'Space Mono', monospace"
          fontSize={8} fill={ts}>(initial state)</text>

        {/* Arrow → complete */}
        <path d="M 310 34 L 360 34 L 360 80"
          fill="none" stroke={phd} strokeWidth={1} markerEnd="url(#sm-arr)" />
        <text x={337} y={27} textAnchor="middle" fontFamily="'Space Mono', monospace"
          fontSize={7.5} fill={ts}>all criteria met</text>

        {/* complete box */}
        <rect x={280} y={80} width={160} height={36} rx={4} fill={bg}
          stroke={ph} strokeWidth={1.5} />
        <text x={360} y={103} textAnchor="middle" fontFamily="'Space Mono', monospace"
          fontSize={10} fontWeight={600} fill={ph}>complete</text>

        {/* Arrow → blocked */}
        <path d="M 150 34 L 100 34 L 100 80"
          fill="none" stroke={sig} strokeWidth={1} markerEnd="url(#sm-arr-sig)" />
        <text x={122} y={27} textAnchor="middle" fontFamily="'Space Mono', monospace"
          fontSize={7.5} fill={sig}>can't proceed</text>

        {/* blocked box */}
        <rect x={20} y={80} width={160} height={36} rx={4} fill={bg}
          stroke={sig} strokeWidth={1.5} />
        <text x={100} y={103} textAnchor="middle" fontFamily="'Space Mono', monospace"
          fontSize={10} fontWeight={600} fill={sig}>blocked</text>
      </svg>

      <div className="afk-state-json">
        <div className="afk-state-json-item">
          <span className="afk-state-json-label">in_progress</span>
          <pre className="afk-code-pre">{'{ "issue": N, "status": "in_progress", "summary": null }'}</pre>
        </div>
        <div className="afk-state-json-item">
          <span className="afk-state-json-label afk-state-json-label--complete">complete</span>
          <pre className="afk-code-pre">{'{ "issue": N, "status": "complete", "summary": "one sentence..." }'}</pre>
        </div>
        <div className="afk-state-json-item">
          <span className="afk-state-json-label afk-state-json-label--blocked">blocked</span>
          <pre className="afk-code-pre">{'{ "issue": N, "status": "blocked", "summary": "reason..." }'}</pre>
        </div>
      </div>
    </div>
  )
}

function AfkPage({ onNavigate, exiting }: AfkPageProps) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'auto'
    return () => { document.body.style.overflow = prev }
  }, [])

  return (
    <div className={`afk-page${exiting ? ' page-exit' : ''}`}>
      <nav className="loop-nav">
        <button className="loop-nav-home" onClick={onNavigate}>← LOOP</button>
        <span className="loop-nav-wordmark">RALPH</span>
      </nav>

      <section className="loop-hero">
        <p className="loop-tag">AUTOMATION</p>
        <h1 className="loop-heading">AFK SCRIPT</h1>
        <p className="loop-subtitle">How ralph automates the grind — annotated for engineers</p>
      </section>

      <main className="afk-main">

        <section className="afk-section">
          <h2 className="afk-section-heading">SCRIPT LIFECYCLE</h2>
          <div className="afk-diagram-wrap">
            <AfkFlowDiagram />
          </div>
        </section>

        <section className="afk-section">
          <h2 className="afk-section-heading">STATUS STATE MACHINE</h2>
          <AfkStateMachine />
        </section>

        <section className="afk-section">
          <h2 className="afk-section-heading">KEY COMMANDS</h2>
          <div className="afk-code-blocks">

            <div>
              <p className="afk-code-block-label">find_next_issue — blocker check loop</p>
              <p className="afk-code-block-desc">Iterates candidates in ascending order and skips any with an open GitHub blocker.</p>
              <pre className="afk-code-pre"><code>{`for blocker in $(grep -oE 'Blocked by #[0-9]+' \\
    <<< "$body" | grep -oE '[0-9]+'); do
  state=$(gh issue view "$blocker" \\
    --json state --jq '.state')
  if [ "$state" = "OPEN" ]; then
    blocked=true
    break
  fi
done`}</code></pre>
            </div>

            <div>
              <p className="afk-code-block-label">docker sandbox run claude — agent invocation</p>
              <p className="afk-code-block-desc">Launches the Claude agent inside a Docker sandbox with the context file prepended as a @-reference.</p>
              <pre className="afk-code-pre"><code>{`docker sandbox run claude -- \\
  --permission-mode acceptEdits \\
  -p "@\${CONTEXT_FILE} ..."`}</code></pre>
              <div className="afk-agent-prompt">
                <p className="afk-agent-prompt-label">PROMPT SENT TO AGENT</p>
                <ol className="afk-agent-prompt-list">
                  <li>Implement every acceptance criterion listed in issue #{'${issue_number}'}.</li>
                  <li>Run tests and type checks to validate your changes.</li>
                  <li>Commit your changes with a descriptive message referencing the issue.</li>
                  <li>Update {'${STATUS_FILE}'} as the final source of truth.</li>
                  <li>If every criterion is met, set status to complete.</li>
                  <li>If work is not complete, set status to blocked.</li>
                </ol>
              </div>
            </div>

            <div>
              <p className="afk-code-block-label">read_status_field — Python JSON reader</p>
              <p className="afk-code-block-desc">Safely extracts a single field from .ralph-status.json; returns an empty string on a missing file or null value.</p>
              <pre className="afk-code-pre"><code>{`read_status_field() {
  python3 - "$STATUS_FILE" "$1" <<'PY'
import json, sys
try:
    with open(sys.argv[1]) as f:
        data = json.load(f)
except Exception:
    sys.exit(0)
value = data.get(sys.argv[2], "")
print("" if value is None else value)
PY
}`}</code></pre>
            </div>

          </div>
        </section>

        <section className="afk-section">
          <h2 className="afk-section-heading">GITHUB API CALLS</h2>
          <div className="afk-api-phases">
            <div>
              <p className="afk-api-phase-label">Issue Discovery</p>
              <div className="afk-api-calls">
                <code className="afk-api-call">gh issue list --state open --label grindable --json number --jq &apos;[.[].number] | sort | .[]&apos;</code>
                <code className="afk-api-call">gh issue view &lt;num&gt; --json body --jq &apos;.body&apos;</code>
                <code className="afk-api-call">gh issue view &lt;blocker&gt; --json state --jq &apos;.state&apos;</code>
              </div>
            </div>
            <div>
              <p className="afk-api-phase-label">Context Gathering</p>
              <div className="afk-api-calls">
                <code className="afk-api-call">gh issue view &lt;N&gt; --json title --jq &apos;.title&apos;</code>
                <code className="afk-api-call">gh issue view &lt;N&gt; --json body --jq &apos;.body&apos;</code>
                <code className="afk-api-call">gh issue view &lt;N&gt; --json comments --jq &apos;[.comments[] | ...]&apos;</code>
                <code className="afk-api-call">gh issue list --state open --label grindable --json number,title</code>
              </div>
            </div>
            <div>
              <p className="afk-api-phase-label">Issue Closure (if complete)</p>
              <div className="afk-api-calls">
                <code className="afk-api-call">gh issue comment &lt;N&gt; --body &quot;$summary&quot;</code>
                <code className="afk-api-call">gh issue close &lt;N&gt;</code>
              </div>
            </div>
          </div>
        </section>

        <section className="afk-section">
          <h2 className="afk-section-heading">DATA FLOW</h2>
          <div className="afk-data-flow-wrap">
            <table className="afk-data-flow-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Written by</th>
                  <th>Read by</th>
                  <th>Deleted by</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>.ralph-context.md</code></td>
                  <td>afk-ralph.sh (each iteration)</td>
                  <td>claude agent (via @-reference in prompt)</td>
                  <td>trap cleanup EXIT</td>
                </tr>
                <tr>
                  <td><code>.ralph-status.json</code></td>
                  <td>afk-ralph.sh (init)<br />claude agent (update on finish)</td>
                  <td>afk-ralph.sh (post-run status check)</td>
                  <td>trap cleanup EXIT</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

      </main>

      <footer className="loop-footer">
        ▸ afk-ralph.sh<span className="blink-cursor">_</span>
      </footer>
    </div>
  )
}

const PAGE_TITLES: Record<Page, string> = {
  home: 'RALPH',
  loop: 'RALPH — LOOP ARCHITECTURE',
  afk: 'AFK Script — RALPH',
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
        if (window.location.hash === '#loop') setPage('loop')
        else if (window.location.hash === '#afk') setPage('afk')
        else setPage('home')
      }
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  function navigate(to: Page) {
    navigatingRef.current = true
    setExiting(true)
    setTimeout(() => {
      if (to === 'loop') window.location.hash = '#loop'
      else if (to === 'afk') window.location.hash = '#afk'
      else window.location.hash = ''
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
        onNavigateAfk={() => navigate('afk')}
        exiting={exiting}
      />
    )
  }

  if (page === 'afk') {
    return (
      <AfkPage
        onNavigate={() => navigate('loop')}
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
