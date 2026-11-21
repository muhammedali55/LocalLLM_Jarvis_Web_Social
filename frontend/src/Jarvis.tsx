import { useCallback, useEffect, useRef, useState } from 'react'
import Reactor, { COLORS, Icon, lookOf, type Look } from './Reactor'
import { VoiceLoop, type Phase } from './voice'

type Info = { notes?: number; error?: string }

const LEGEND: { look: Look; name: string; sub: string }[] = [
  { look: 'ready', name: 'Hazır', sub: 'Sakin' },
  { look: 'listen', name: 'Dinleme', sub: 'Seni duyuyor' },
  { look: 'think', name: 'Düşünme', sub: 'Yerel Qwen' },
  { look: 'search', name: 'Yerel Arama', sub: 'Bu Mac’teki notlar' },
  { look: 'answer', name: 'Cevaplıyor', sub: 'Sesli yanıt' },
  { look: 'done', name: 'Tamamlandı', sub: 'Oturum kapandı' },
]

type Step = { text: string; done: boolean }

function card(phase: Phase, info: Info): { title: string; steps?: Step[]; note?: string } {
  switch (phase) {
    case 'idle':
      return { title: 'Hazır', note: 'Başlatmak için reaktöre dokun ya da Boşluk tuşuna bas.' }
    case 'listening':
      return { title: 'Dinliyorum…', note: 'Konuş; sustuğunda cevap vereceğim.' }
    case 'hearing':
      return { title: 'Dinliyorum…', note: 'Seni duyuyorum.' }
    case 'transcribing':
      return { title: 'Düşünüyorum…', steps: [
        { text: 'Sesini aldım', done: true },
        { text: 'Söylediğini yerelde anlıyorum', done: false },
        { text: 'Cevabı hazırlıyorum', done: false },
      ] }
    case 'thinking':
      return { title: 'Düşünüyorum…', steps: [
        { text: 'Sesini aldım', done: true },
        { text: 'Söylediğini anladım', done: true },
        { text: 'Yerel Qwen cevabı hazırlıyor', done: false },
      ] }
    case 'searching':
      return { title: 'Yerel notlarda arıyorum…', steps: [
        { text: 'Bu Mac’teki notlar tarandı', done: true },
        { text: `${info.notes ?? 1} ilgili not bulundu`, done: true },
        { text: 'Cevap hazırlanıyor', done: false },
      ] }
    case 'speaking':
      return { title: 'Cevaplıyorum', note: 'Bitirince seni yine dinleyeceğim.' }
    case 'done':
      return { title: 'Görüşmek üzere ✓', note: 'Oturum kapandı. Tekrar başlatmak için dokun.' }
    case 'error':
      return { title: 'Bir sorun oldu', note: info.error }
  }
}

function useLevel(loop: VoiceLoop, phase: Phase) {
  const [level, setLevel] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    let raf = 0
    const buf = new Uint8Array(1024)
    let t = 0
    const draw = () => {
      t += 1
      const an = phase === 'speaking' ? loop.outAnalyser : phase === 'listening' || phase === 'hearing' ? loop.micAnalyser : null
      let lv = 0
      const cv = canvasRef.current
      const ctx = cv?.getContext('2d')
      if (an) {
        an.getByteTimeDomainData(buf)
        let s = 0
        for (let i = 0; i < an.fftSize; i++) s += (buf[i] - 128) ** 2
        lv = Math.min(1, Math.sqrt(s / an.fftSize) / 28)
      }
      setLevel((p) => p * 0.6 + lv * 0.4)
      if (cv && ctx) {
        const w = (cv.width = cv.clientWidth * devicePixelRatio)
        const h = (cv.height = cv.clientHeight * devicePixelRatio)
        ctx.clearRect(0, 0, w, h)
        const col = COLORS[lookOf(phase)].main
        for (const [alpha, width, amp] of [[0.25, 8, 1.15], [0.9, 2.5, 1]] as const) {
          ctx.beginPath()
          for (let x = 0; x <= w; x += 4) {
            const u = x / w
            const env = Math.sin(Math.PI * u) ** 1.5
            let y: number
            if (an) {
              const idx = Math.floor(u * (an.fftSize - 1))
              y = ((buf[idx] - 128) / 128) * h * 2.2 * env
            } else {
              const busy = phase === 'transcribing' || phase === 'thinking' || phase === 'searching' ? 0.08 : 0.025
              y = Math.sin(u * 22 + t * 0.06) * h * busy * env
            }
            const yy = h / 2 + y * amp
            if (x === 0) ctx.moveTo(x, yy)
            else ctx.lineTo(x, yy)
          }
          ctx.strokeStyle = col
          ctx.globalAlpha = alpha
          ctx.lineWidth = width * devicePixelRatio
          ctx.shadowColor = col
          ctx.shadowBlur = 16
          ctx.stroke()
        }
        ctx.globalAlpha = 1
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [loop, phase])
  return { level, canvasRef }
}

function Bars({ level, color }: { level: number; color: string }) {
  return (
    <div className="mini-bars" style={{ color }}>
      {Array.from({ length: 14 }, (_, i) => {
        const h = 0.15 + Math.abs(Math.sin(i * 1.7 + level * 9)) * level * 0.85 + level * 0.15
        return <span key={i} style={{ height: `${Math.min(1, h) * 100}%` }} />
      })}
    </div>
  )
}

export default function Jarvis() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [info, setInfo] = useState<Info>({})
  const loopRef = useRef<VoiceLoop | null>(null)
  if (!loopRef.current) {
    loopRef.current = new VoiceLoop({
      phase: (p, i) => {
        setPhase(p)
        setInfo(i ?? {})
      },
    })
  }
  const loop = loopRef.current
  // Yalnızca geliştirmede: görsel durumları test etmek için
  if (import.meta.env.DEV) (window as unknown as { __jarvis: VoiceLoop }).__jarvis = loop
  const { level, canvasRef } = useLevel(loop, phase)
  const look = lookOf(phase)
  const col = COLORS[look]
  const c = card(phase, info)

  const toggle = useCallback(() => {
    if (loop.active) loop.stop()
    else loop.start()
  }, [loop])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.code === 'Space') {
        e.preventDefault()
        toggle()
      } else if (e.code === 'Escape' && loop.active) {
        loop.stop()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle, loop])

  useEffect(() => () => loop.stop(true), [loop])

  const active = loop.active

  return (
    <section className={`jv look-${look}`} style={{ ['--c' as string]: col.main, ['--hi' as string]: col.hi }}>
      <div className="jv-stage">
        <canvas ref={canvasRef} className="jv-wave" />
        <button className="jv-reactor" onClick={toggle} aria-label={active ? 'Oturumu kapat' : 'Jarvis’i başlat'}>
          <Reactor look={look} level={level} />
        </button>

        <div className="jv-side">
          <div className="jv-brand">
            <div className="jv-word">JARVIS</div>
            <div className="jv-sub">Kişisel Yapay Zekâ Asistanın · bu Mac’te, internetsiz</div>
          </div>

          <div className="jv-card" key={phase}>
            <div className="jv-card-title">
              {c.title}
              {(phase === 'listening' || phase === 'hearing' || phase === 'speaking') && <Bars level={level} color={col.main} />}
            </div>
            {c.steps && (
              <ul className="jv-steps">
                {c.steps.map((s) => (
                  <li key={s.text} className={s.done ? 'ok' : 'wait'}>
                    <span className="mark">{s.done ? '✓' : ''}</span>
                    {s.text}
                  </li>
                ))}
              </ul>
            )}
            {c.note && <p className="jv-note">{c.note}</p>}
          </div>

          <div className="jv-hint">
            {active ? (
              <>Bitirmek için <b>“Jarvis, kapat”</b> de · ya da reaktöre dokun / Esc</>
            ) : (
              <>Bir kez başlat, sonra sadece konuş. Ekrana hiçbir şey yazmana gerek yok.</>
            )}
          </div>
        </div>
      </div>

      <div className="jv-legend">
        <div className="jv-legend-title">Durumlar</div>
        {LEGEND.map((l, i) => (
          <div key={l.look} className={`jv-leg ${l.look === look ? 'on' : ''}`} style={{ ['--lc' as string]: COLORS[l.look].main }}>
            {i > 0 && <span className="arrow">→</span>}
            <svg viewBox="200 200 200 200" className="leg-icon" style={{ color: COLORS[l.look].hi }}>
              <circle cx="300" cy="300" r="92" fill={COLORS[l.look].deep} stroke={COLORS[l.look].main} strokeWidth="8" />
              <Icon look={l.look} />
            </svg>
            <div>
              <div className="leg-name">{l.name}</div>
              <div className="leg-sub">{l.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <p className="jv-foot">
        Sesin bellekte işlenip hemen silinir; söyledikleri ve cevaplar ekrana yazılmaz, diske kaydedilmez. Tarayıcının bulut konuşma tanıması kullanılmaz.
      </p>
    </section>
  )
}
