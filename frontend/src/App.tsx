import { useEffect, useState } from 'react'
import { getHealth, type Health } from './api'
import Jarvis from './Jarvis'
import Search from './Search'
import Overlay from './Overlay'
import Social from './Social'

type Tab = 'jarvis' | 'search' | 'social'

const TABS: { id: Tab; label: string; ready: boolean }[] = [
  { id: 'search', label: 'Yerel Arama', ready: true },
  { id: 'social', label: 'Bot Sosyal', ready: true },
  { id: 'jarvis', label: 'Jarvis', ready: true },
]

function StatusBar() {
  const [h, setH] = useState<Health | null>(null)
  const [down, setDown] = useState(false)

  useEffect(() => {
    let alive = true
    const tick = () =>
      getHealth()
        .then((x) => alive && (setH(x), setDown(false)))
        .catch(() => alive && setDown(true))
    tick()
    const id = setInterval(tick, 10000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  if (down) return <div className="status bad">Yerel backend kapalı · ./start-local.sh</div>
  if (!h) return <div className="status">Yerel servisler kontrol ediliyor…</div>
  const dot = (ok: boolean) => <span className={`dot ${ok ? 'on' : 'off'}`} />
  return (
    <div className="status">
      <span>{dot(h.llm.ok)}{h.llm.model} · {h.llm.runner}</span>
      <span>{dot(h.asr.ok)}{h.asr.engine}</span>
      <span>{dot(h.tts.ok)}Ses: {h.tts.voice}</span>
    </div>
  )
}

export default function App() {
  // Arka plan Jarvis penceresi: yalnızca reaktör
  if (window.location.hash === '#overlay') return <Overlay />
  return <Shell />
}

function Shell() {
  // Sekme adres çubuğunda tutulur (#search, #jarvis): çekimde doğrudan açmak için
  const [tab, setTabState] = useState<Tab>(() => {
    const h = window.location.hash.slice(1) as Tab
    return TABS.some((t) => t.id === h && t.ready) ? h : 'search'
  })
  const setTab = (t: Tab) => {
    setTabState(t)
    history.replaceState(null, '', `#${t}`)
  }
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" /> Yerel İnternet
          <span className="badge">Bu Mac'te · internetsiz</span>
        </div>
        <nav>
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? 'active' : ''}
              disabled={!t.ready}
              title={t.ready ? '' : 'Sıradaki adımda eklenecek'}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <StatusBar />
      </header>
      <main>
        {tab === 'search' && <Search />}
        {tab === 'social' && <Social />}
        {tab === 'jarvis' && <Jarvis />}
      </main>
    </div>
  )
}
