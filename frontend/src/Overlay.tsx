import { useEffect, useState } from 'react'
import Reactor, { COLORS, lookOf } from './Reactor'
import type { Phase } from './voice'

// Arka plan Jarvis servisi (daemon/jarvis_daemon.py) bu sayfayı çerçevesiz bir pencerede açar
// ve durumu window.__jarvisOverlay üzerinden iletir. Sayfa kendi başına mikrofon kullanmaz.

const TITLES: Record<Phase, string> = {
  idle: 'Uykuda',
  listening: 'Dinliyorum…',
  hearing: 'Dinliyorum…',
  transcribing: 'Anlıyorum…',
  thinking: 'Düşünüyorum…',
  searching: 'Yerel notlarda arıyorum…',
  speaking: 'Cevaplıyorum',
  done: 'Görüşmek üzere',
  error: 'Bir sorun oldu',
}

type Api = { set: (p: Phase, info?: { error?: string }) => void; level: (l: number) => void }

export default function Overlay() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [level, setLevel] = useState(0)
  const [err, setErr] = useState('')

  useEffect(() => {
    document.documentElement.classList.add('overlay-mode')
    const api: Api = {
      set: (p, info) => {
        setPhase(p)
        setErr(info?.error ?? '')
        if (p !== 'speaking' && p !== 'listening' && p !== 'hearing') setLevel(0)
      },
      level: (l) => setLevel((prev) => prev * 0.4 + l * 0.6),
    }
    ;(window as unknown as { __jarvisOverlay: Api }).__jarvisOverlay = api
    return () => document.documentElement.classList.remove('overlay-mode')
  }, [])

  const look = lookOf(phase)
  const c = COLORS[look]
  return (
    <div className={`ov look-${look}`} style={{ ['--c' as string]: c.main, ['--hi' as string]: c.hi }}>
      <div className="ov-reactor">
        <Reactor look={look} level={level} />
      </div>
      <div className="ov-label" key={phase}>
        <span className="ov-name">JARVIS</span>
        <span className="ov-state">{TITLES[phase]}</span>
        {err && <span className="ov-err">{err}</span>}
      </div>
    </div>
  )
}
