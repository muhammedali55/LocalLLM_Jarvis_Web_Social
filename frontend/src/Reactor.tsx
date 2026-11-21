import type { Phase } from './voice'

export type Look = 'ready' | 'listen' | 'think' | 'search' | 'answer' | 'done' | 'error'

export function lookOf(p: Phase): Look {
  switch (p) {
    case 'listening':
    case 'hearing':
      return 'listen'
    case 'transcribing':
    case 'thinking':
      return 'think'
    case 'searching':
      return 'search'
    case 'speaking':
      return 'answer'
    case 'done':
      return 'done'
    case 'error':
      return 'error'
    default:
      return 'ready'
  }
}

export const COLORS: Record<Look, { main: string; hi: string; deep: string }> = {
  ready: { main: '#22d3ee', hi: '#a5f3fc', deep: '#083344' },
  listen: { main: '#38bdf8', hi: '#bae6fd', deep: '#0c2a4a' },
  think: { main: '#fb923c', hi: '#fed7aa', deep: '#431407' },
  search: { main: '#60a5fa', hi: '#dbeafe', deep: '#172554' },
  answer: { main: '#34d399', hi: '#a7f3d0', deep: '#022c22' },
  done: { main: '#4ade80', hi: '#bbf7d0', deep: '#052e16' },
  error: { main: '#f43f5e', hi: '#fecdd3', deep: '#4c0519' },
}

// Merkez simgeleri (600x600 kutuda, merkez 300,300)
export function Icon({ look }: { look: Look }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (look) {
    case 'ready':
      return (
        <g {...common}>
          <path d="M240 268 L360 268 L300 368 Z" />
          <path d="M272 286 L328 286 L300 334 Z" fill="currentColor" opacity=".35" strokeWidth={5} />
        </g>
      )
    case 'listen':
      return (
        <g {...common}>
          <rect x="276" y="236" width="48" height="84" rx="24" fill="currentColor" fillOpacity=".25" />
          <path d="M256 298 a44 44 0 0 0 88 0" />
          <path d="M300 342 V364 M278 364 H322" />
        </g>
      )
    case 'think':
      return (
        <g {...common} strokeWidth={7}>
          <path d="M298 250 c-10-14-38-14-46 4 c-20 0-32 22-22 38 c-14 12-8 38 12 42 c2 18 28 26 42 12 c4 2 10 2 14 0 Z" />
          <path d="M302 250 c10-14 38-14 46 4 c20 0 32 22 22 38 c14 12 8 38-12 42 c-2 18-28 26-42 12" />
          <path d="M300 252 V346" />
          <path d="M262 286 c10 0 16 6 16 14 M338 286 c-10 0-16 6-16 14 M270 322 c8-6 18-4 22 4 M330 322 c-8-6-18-4-22 4" strokeWidth={5} />
        </g>
      )
    case 'search':
      return (
        <g {...common}>
          <rect x="246" y="236" width="76" height="98" rx="10" fill="currentColor" fillOpacity=".15" />
          <path d="M264 264 H304 M264 284 H304 M264 304 H286" strokeWidth={6} />
          <circle cx="322" cy="324" r="26" fill="#020617" fillOpacity=".6" />
          <path d="M341 343 L364 366" />
        </g>
      )
    case 'answer':
      return (
        <g {...common}>
          <path d="M234 262 L366 262 L300 372 Z" />
          <path d="M272 300 L294 322 L332 284" strokeWidth={11} />
        </g>
      )
    case 'done':
      return (
        <g {...common}>
          <circle cx="300" cy="300" r="62" fill="currentColor" fillOpacity=".12" />
          <path d="M266 302 L292 328 L338 278" strokeWidth={13} />
        </g>
      )
    case 'error':
      return (
        <g {...common}>
          <path d="M300 246 V312" strokeWidth={14} />
          <circle cx="300" cy="350" r="8" fill="currentColor" />
        </g>
      )
  }
}

const TICKS = Array.from({ length: 120 }, (_, i) => i)
const SEGS = Array.from({ length: 18 }, (_, i) => i)

export default function Reactor({ look, level }: { look: Look; level: number }) {
  const c = COLORS[look]
  const lv = Math.min(1, level)
  return (
    <svg
      className={`reactor look-${look}`}
      viewBox="0 0 600 600"
      style={{ ['--c' as string]: c.main, ['--hi' as string]: c.hi, ['--lv' as string]: lv, color: c.hi }}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="r-glow">
          <stop offset="0" stopColor={c.main} stopOpacity=".55" />
          <stop offset=".45" stopColor={c.main} stopOpacity=".12" />
          <stop offset="1" stopColor={c.main} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="r-core">
          <stop offset="0" stopColor={c.hi} stopOpacity=".55" />
          <stop offset=".35" stopColor={c.main} stopOpacity=".55" />
          <stop offset=".8" stopColor={c.deep} stopOpacity=".95" />
          <stop offset="1" stopColor={c.main} stopOpacity=".9" />
        </radialGradient>
        <filter id="r-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      <circle cx="300" cy="300" r="300" fill="url(#r-glow)" className="r-aura" />

      {/* Dış ölçek halkası */}
      <g className="r-spin r-spin-slow" stroke={c.main}>
        {TICKS.map((i) => {
          const a = (i / 120) * Math.PI * 2
          const long = i % 10 === 0
          const r1 = long ? 252 : 258
          return (
            <line key={i} x1={300 + Math.cos(a) * r1} y1={300 + Math.sin(a) * r1} x2={300 + Math.cos(a) * 266} y2={300 + Math.sin(a) * 266}
              strokeWidth={long ? 3 : 1.5} opacity={long ? 0.9 : 0.45} />
          )
        })}
      </g>

      {/* Kesik yaylar */}
      <g className="r-spin r-spin-rev" fill="none" stroke={c.main} strokeLinecap="round">
        <circle cx="300" cy="300" r="232" strokeWidth="6" strokeDasharray="160 60 40 90 220 120 60 708" opacity=".85" />
        <circle cx="300" cy="300" r="232" strokeWidth="14" strokeDasharray="40 1418" opacity=".9" filter="url(#r-blur)" />
      </g>
      <g className="r-spin r-spin-mid" fill="none" stroke={c.hi} strokeLinecap="round" opacity=".6">
        <circle cx="300" cy="300" r="212" strokeWidth="2" strokeDasharray="4 10" />
      </g>

      {/* Bölümlü reaktör halkası */}
      <g className="r-spin r-spin-seg">
        {SEGS.map((i) => (
          <circle key={i} cx="300" cy="300" r="178" fill="none" stroke={c.main} strokeWidth="38"
            strokeDasharray={`${(2 * Math.PI * 178) / 18 - 9} ${2 * Math.PI * 178}`}
            transform={`rotate(${(i * 360) / 18} 300 300)`}
            className="r-seg" style={{ animationDelay: `${(i * -1.6) / 18}s` }} />
        ))}
        <circle cx="300" cy="300" r="178" fill="none" stroke={c.hi} strokeWidth="2" opacity=".35" />
      </g>

      {/* İç halkalar */}
      <circle cx="300" cy="300" r="146" fill="none" stroke={c.main} strokeWidth="3" opacity=".8" />
      <g className="r-spin r-spin-fast" fill="none" stroke={c.hi}>
        <circle cx="300" cy="300" r="134" strokeWidth="5" strokeDasharray="70 30 20 30" opacity=".7" />
      </g>

      {/* Çekirdek */}
      <circle cx="300" cy="300" r="118" fill="url(#r-core)" className="r-core" />
      <circle cx="300" cy="300" r="118" fill="none" stroke={c.main} strokeWidth="4" filter="url(#r-blur)" />
      <g className="r-icon">
        <Icon look={look} />
      </g>
    </svg>
  )
}
