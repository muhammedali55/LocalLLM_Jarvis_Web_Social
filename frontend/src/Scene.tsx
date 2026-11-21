// Bot "fotoğrafları": dış görsel yok; Qwen'in seçtiği motif + ruh haline göre tarayıcıda çizilen SVG sahneler.

export type SceneSpec = { motif: string; mood: string }

const PAL: Record<string, { sky: [string, string]; sun: string; land: [string, string, string]; water: [string, string]; tint: string }> = {
  sabah: { sky: ['#bae6fd', '#fde68a'], sun: '#fbbf24', land: ['#64748b', '#475569', '#334155'], water: ['#38bdf8', '#0369a1'], tint: '#fef3c7' },
  gunbatimi: { sky: ['#7c3aed', '#fb923c'], sun: '#fde047', land: ['#4c1d95', '#3b0764', '#1e1b4b'], water: ['#f97316', '#7c2d12'], tint: '#fed7aa' },
  gece: { sky: ['#020617', '#312e81'], sun: '#e2e8f0', land: ['#1e293b', '#0f172a', '#020617'], water: ['#1e3a8a', '#020617'], tint: '#c7d2fe' },
  pastel: { sky: ['#fbcfe8', '#bfdbfe'], sun: '#fef9c3', land: ['#a5b4fc', '#818cf8', '#6366f1'], water: ['#99f6e4', '#5eead4'], tint: '#fdf4ff' },
}

function rng(seed: number) {
  let s = seed % 2147483647 || 1
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

export default function Scene({ spec, seed }: { spec: SceneSpec; seed: number }) {
  const p = PAL[spec.mood] ?? PAL.sabah
  const r = rng(seed * 97 + 13)
  const id = `s${seed}`
  const night = spec.mood === 'gece'
  const stars = night || spec.motif === 'gece'
    ? Array.from({ length: 60 }, (_, i) => <circle key={i} cx={r() * 400} cy={r() * 220} r={r() * 1.6 + 0.3} fill="#fff" opacity={r() * 0.8 + 0.2} />)
    : null

  const sky = (
    <>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.sky[0]} />
          <stop offset="1" stopColor={p.sky[1]} />
        </linearGradient>
        <linearGradient id={`${id}-water`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.water[0]} />
          <stop offset="1" stopColor={p.water[1]} />
        </linearGradient>
        <radialGradient id={`${id}-sun`}>
          <stop offset="0" stopColor={p.sun} />
          <stop offset=".6" stopColor={p.sun} stopOpacity=".6" />
          <stop offset="1" stopColor={p.sun} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="400" fill={`url(#${id}-sky)`} />
      {stars}
    </>
  )
  const sun = (cx: number, cy: number, rad = 34) => (
    <>
      <circle cx={cx} cy={cy} r={rad * 2.4} fill={`url(#${id}-sun)`} opacity=".55" />
      <circle cx={cx} cy={cy} r={rad} fill={p.sun} />
    </>
  )

  let body: React.ReactNode
  switch (spec.motif) {
    case 'dag':
      body = (
        <>
          {sun(260 + r() * 60, 110, 30)}
          <path d="M0 290 L90 170 L150 230 L230 120 L320 220 L400 160 L400 400 L0 400 Z" fill={p.land[0]} />
          <path d="M230 120 L255 152 L240 148 L228 160 L215 146 L205 152 Z" fill="#f8fafc" opacity=".9" />
          <path d="M0 330 L110 240 L200 300 L290 230 L400 300 L400 400 L0 400 Z" fill={p.land[1]} />
          <path d="M0 370 L140 320 L260 360 L400 330 L400 400 L0 400 Z" fill={p.land[2]} />
        </>
      )
      break
    case 'sehir': {
      const blds = Array.from({ length: 11 }, (_, i) => {
        const w = 26 + r() * 22, h = 90 + r() * 170, x = i * 37 - 6
        const wins = []
        for (let yy = 400 - h + 12; yy < 384; yy += 16)
          for (let xx = x + 6; xx < x + w - 8; xx += 10)
            if (r() > 0.45) wins.push(<rect key={`${xx}-${yy}`} x={xx} y={yy} width="5" height="7" fill={night ? '#fde68a' : p.tint} opacity={night ? 0.9 : 0.5} />)
        return (
          <g key={i}>
            <rect x={x} y={400 - h} width={w} height={h} fill={i % 2 ? p.land[1] : p.land[2]} />
            {wins}
          </g>
        )
      })
      body = (<>{sun(80, 90, night ? 22 : 30)}{blds}</>)
      break
    }
    case 'kod':
      body = (
        <>
          <rect x="44" y="70" width="312" height="240" rx="14" fill="#0b1220" stroke={p.tint} strokeOpacity=".35" />
          <rect x="44" y="70" width="312" height="30" rx="14" fill="#111a2e" />
          {['#f43f5e', '#f59e0b', '#22c55e'].map((c, i) => <circle key={c} cx={66 + i * 18} cy="85" r="5" fill={c} />)}
          {Array.from({ length: 9 }, (_, i) => {
            const indent = [0, 1, 2, 2, 1, 1, 2, 1, 0][i] * 18
            const cols = ['#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#f472b6']
            return (
              <g key={i}>
                <rect x={66 + indent} y={116 + i * 20} width={30 + r() * 40} height="8" rx="4" fill={cols[i % 5]} />
                <rect x={104 + indent + r() * 30} y={116 + i * 20} width={40 + r() * 90} height="8" rx="4" fill="#64748b" />
              </g>
            )
          })}
          <rect x="120" y="310" width="160" height="14" rx="4" fill="#1e293b" />
          <rect x="70" y="324" width="260" height="10" rx="5" fill="#334155" />
          <g transform="translate(318 330)">
            <path d="M0 0 h34 v30 a12 12 0 0 1 -12 12 h-10 a12 12 0 0 1 -12 -12 Z" fill="#f8fafc" />
            <path d="M34 8 a8 8 0 0 1 0 16" fill="none" stroke="#f8fafc" strokeWidth="4" />
            <path d="M10 -6 q4 -8 0 -16 M22 -6 q4 -8 0 -16" stroke={p.tint} strokeWidth="2.5" fill="none" opacity=".7" />
          </g>
        </>
      )
      break
    case 'kahve':
      body = (
        <>
          {sun(320, 80, 26)}
          <rect y="270" width="400" height="130" fill={p.land[1]} />
          <rect y="262" width="400" height="12" fill={p.land[0]} />
          <ellipse cx="200" cy="330" rx="96" ry="18" fill="#0f172a" opacity=".25" />
          <path d="M130 200 h140 v70 a50 50 0 0 1 -50 50 h-40 a50 50 0 0 1 -50 -50 Z" fill="#f8fafc" />
          <ellipse cx="200" cy="200" rx="70" ry="12" fill="#78350f" />
          <path d="M270 222 a26 26 0 0 1 0 52" fill="none" stroke="#f8fafc" strokeWidth="10" />
          {[170, 200, 230].map((x, i) => (
            <path key={x} d={`M${x} 180 q12 -22 0 -44 q-12 -22 0 -44`} fill="none" stroke={p.tint} strokeWidth="5" strokeLinecap="round" opacity={0.55 - i * 0.1} />
          ))}
        </>
      )
      break
    case 'gece':
      body = (
        <>
          <circle cx="290" cy="100" r="34" fill="#f1f5f9" />
          <circle cx="306" cy="90" r="30" fill={p.sky[0]} />
          <path d="M0 320 Q100 260 200 300 T400 280 L400 400 L0 400 Z" fill={p.land[1]} />
          <path d="M0 360 Q120 320 240 350 T400 340 L400 400 L0 400 Z" fill={p.land[2]} />
          <path d="M70 330 l14 -40 l14 40 Z M98 335 l10 -28 l10 28 Z" fill={p.land[2]} />
        </>
      )
      break
    case 'orman': {
      const trees = Array.from({ length: 16 }, (_, i) => {
        const x = (i / 15) * 420 - 10 + r() * 10, h = 120 + r() * 90, layer = i % 3
        const base = 400 - layer * 30
        return <path key={i} d={`M${x} ${base - h} L${x + 34} ${base} L${x - 34} ${base} Z`} fill={p.land[2 - layer]} opacity={1 - layer * 0.15} />
      })
      body = (<>{sun(200, 120, 40)}<rect y="230" width="400" height="170" fill={p.tint} opacity=".25" />{trees}</>)
      break
    }
    default: // deniz
      body = (
        <>
          {sun(200, 190, 38)}
          <rect y="220" width="400" height="180" fill={`url(#${id}-water)`} />
          {Array.from({ length: 8 }, (_, i) => (
            <path key={i} d={`M${r() * 300} ${236 + i * 20} h${40 + r() * 80}`} stroke="#fff" strokeOpacity={0.35 - i * 0.03} strokeWidth="3" strokeLinecap="round" />
          ))}
          <path d="M240 262 h70 l-12 14 h-48 Z" fill={p.land[2]} />
          <path d="M272 262 v-48 l26 40 Z" fill="#f8fafc" opacity=".9" />
        </>
      )
  }

  return (
    <svg viewBox="0 0 400 400" className="scene" role="img" aria-label={`Yerel çizim: ${spec.motif}, ${spec.mood}`}>
      {sky}
      {body}
    </svg>
  )
}
