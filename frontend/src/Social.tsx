import { useEffect, useMemo, useRef, useState } from 'react'
import Scene, { type SceneSpec } from './Scene'

type Bot = { id: string; name: string; handle: string; color: string; bio: string; group: string }
type Group = { id: string; name: string; description: string }
type Comment = { id: number; bot: string; text: string; source: string; seconds: number | null; created: number }
type Post = {
  id: number; bot: string; kind: 'photo' | 'text'; group: string | null; text: string
  scene: SceneSpec | null; likes: string[]; source: string; seconds: number | null; created: number; comments: Comment[]
}
type Feed = { bots: Bot[]; groups: Group[]; posts: Post[]; round: number; db: string }
type Step = { bot: string; action: 'photo' | 'text' | 'comment'; label: string; state: 'wait' | 'run' | 'done'; seconds?: number }
type View = 'kare' | 'pano'

function ago(t: number) {
  const s = Date.now() / 1000 - t
  if (s < 60) return 'az önce'
  if (s < 3600) return `${Math.floor(s / 60)} dk`
  if (s < 86400) return `${Math.floor(s / 3600)} sa`
  return `${Math.floor(s / 86400)} g`
}

function Avatar({ bot, size = 34 }: { bot?: Bot; size?: number }) {
  if (!bot) return null
  const initials = bot.name.split(' ').map((w) => w[0]).join('').slice(0, 2)
  return (
    <span className="av" style={{ width: size, height: size, fontSize: size * 0.38, ['--ac' as string]: bot.color }}>
      {initials}
    </span>
  )
}

function Origin({ item }: { item: { source: string; seconds: number | null } }) {
  return item.source === 'qwen' ? (
    <span className="origin qwen" title="Yerel Qwen tarafından üretildi">Qwen · yerel{item.seconds ? ` · ${item.seconds.toFixed(1)} sn` : ''}</span>
  ) : (
    <span className="origin seed" title="Önceden hazırlanmış demo içeriği">hazır demo</span>
  )
}

const Heart = () => (
  <svg viewBox="0 0 24 24" className="ico"><path d="M12 20s-7-4.4-9.3-9C1.2 7.8 3.2 4 6.8 4c2 0 3.4 1.1 4.2 2.4h2C13.8 5.1 15.2 4 17.2 4c3.6 0 5.6 3.8 4.1 7-2.3 4.6-9.3 9-9.3 9Z" fill="currentColor" /></svg>
)
const Bubble = () => (
  <svg viewBox="0 0 24 24" className="ico"><path d="M4 5h16v11H9l-5 4Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
)

function Comments({ post, bots, typing }: { post: Post; bots: Record<string, Bot>; typing?: string }) {
  return (
    <ul className="cmts">
      {post.comments.map((c) => (
        <li key={c.id} className="cmt fresh-in">
          <Avatar bot={bots[c.bot]} size={26} />
          <div className="cmt-body">
            <div>
              <b>{bots[c.bot]?.name}</b> <span className="muted-x">@{bots[c.bot]?.handle}</span>
            </div>
            <div>{c.text}</div>
            <div className="cmt-meta">{ago(c.created)} · <Origin item={c} /></div>
          </div>
        </li>
      ))}
      {typing && (
        <li className="cmt typing">
          <Avatar bot={bots[typing]} size={26} />
          <div className="cmt-body"><b>{bots[typing]?.name}</b> <span className="dots">yazıyor</span></div>
        </li>
      )}
    </ul>
  )
}

function PhotoCard({ post, bots, groups, typing, fresh }: { post: Post; bots: Record<string, Bot>; groups: Record<string, Group>; typing?: string; fresh: boolean }) {
  const b = bots[post.bot]
  return (
    <article className={`pcard ${fresh ? 'fresh' : ''}`}>
      <header>
        <Avatar bot={b} />
        <div className="who">
          <b>{b?.name}</b>
          <span>@{b?.handle}{post.group ? ` · ${groups[post.group]?.name}` : ''}</span>
        </div>
        <Origin item={post} />
      </header>
      {post.scene && (
        <div className="photo">
          <Scene spec={post.scene} seed={post.id} />
          <span className="photo-tag">yerel çizim</span>
        </div>
      )}
      <div className="acts">
        <span className="act liked"><Heart /> {post.likes.length}</span>
        <span className="act"><Bubble /> {post.comments.length}</span>
        {post.likes.length > 0 && (
          <span className="likers">
            {post.likes.map((id) => <Avatar key={id} bot={bots[id]} size={20} />)}
            <em>beğendi</em>
          </span>
        )}
        <span className="when">{ago(post.created)}</span>
      </div>
      <p className="caption"><b>{b?.handle}</b> {post.text}</p>
      <Comments post={post} bots={bots} typing={typing} />
    </article>
  )
}

function TextCard({ post, bots, groups, typing, fresh }: { post: Post; bots: Record<string, Bot>; groups: Record<string, Group>; typing?: string; fresh: boolean }) {
  const b = bots[post.bot]
  return (
    <article className={`tcard ${fresh ? 'fresh' : ''}`}>
      <header>
        <Avatar bot={b} size={40} />
        <div className="who">
          <b>{b?.name} {post.group && <span className="to">› {groups[post.group]?.name}</span>}</b>
          <span>{ago(post.created)} · @{b?.handle}</span>
        </div>
        <Origin item={post} />
      </header>
      <p className="ttext">{post.text}</p>
      <div className="acts">
        <span className="act liked"><Heart /> {post.likes.length}</span>
        <span className="act"><Bubble /> {post.comments.length} yorum</span>
        {post.likes.length > 0 && (
          <span className="likers">{post.likes.map((id) => <Avatar key={id} bot={bots[id]} size={20} />)}</span>
        )}
      </div>
      <Comments post={post} bots={bots} typing={typing} />
    </article>
  )
}

export default function Social() {
  const [feed, setFeed] = useState<Feed | null>(null)
  const [view, setView] = useState<View>('kare')
  const [steps, setSteps] = useState<Step[]>([])
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [freshId, setFreshId] = useState<number | null>(null)
  const [typing, setTyping] = useState<{ post: number; bot: string } | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const topRef = useRef<HTMLDivElement | null>(null)

  const load = async () => {
    try {
      const r = await fetch('/api/social/feed')
      if (!r.ok) throw new Error()
      setFeed(await r.json())
    } catch {
      setError('Yerel backend kapalı görünüyor (127.0.0.1:8765).')
    }
  }
  useEffect(() => { load() }, [])

  const bots = useMemo(() => Object.fromEntries((feed?.bots ?? []).map((b) => [b.id, b])), [feed])
  const groups = useMemo(() => Object.fromEntries((feed?.groups ?? []).map((g) => [g.id, g])), [feed])

  const upsert = (p: Post) =>
    setFeed((f) => {
      if (!f) return f
      const others = f.posts.filter((x) => x.id !== p.id)
      return { ...f, posts: [p, ...others].sort((a, b) => b.created - a.created || b.id - a.id) }
    })

  const run = async () => {
    setError('')
    setTotal(null)
    setRunning(true)
    let postId: number | null = null
    let queue: Step[] = []
    try {
      const r = await fetch('/api/social/run', { method: 'POST' })
      if (!r.ok || !r.body) throw new Error('Yerel backend yanıt vermedi.')
      const reader = r.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        let nl
        while ((nl = buf.indexOf('\n')) >= 0) {
          const e = JSON.parse(buf.slice(0, nl))
          buf = buf.slice(nl + 1)
          if (e.type === 'queue') {
            queue = e.steps.map((s: Omit<Step, 'state'>) => ({ ...s, state: 'wait' as const }))
            setSteps(queue)
            setView(e.steps[0].action === 'photo' ? 'kare' : 'pano')
            topRef.current?.scrollIntoView({ behavior: 'smooth' })
          } else if (e.type === 'step_start') {
            setSteps((s) => s.map((x, i) => (i === e.i ? { ...x, state: 'run' } : x)))
            if (postId && queue[e.i]) setTyping({ post: postId, bot: queue[e.i].bot })
          } else if (e.type === 'post') {
            postId = e.post.id
            setFreshId(e.post.id)
            setTyping(null)
            upsert(e.post)
          } else if (e.type === 'step_done') {
            setSteps((s) => s.map((x, i) => (i === e.i ? { ...x, state: 'done', seconds: e.seconds } : x)))
          } else if (e.type === 'done') {
            setTotal(e.seconds)
            setFeed((f) => (f ? { ...f, round: f.round + 1 } : f))
          } else if (e.type === 'error') {
            throw new Error(e.message)
          }
        }
      }
    } catch (err) {
      setError(err instanceof TypeError ? 'Yerel backend kapalı görünüyor (127.0.0.1:8765).' : (err as Error).message)
    } finally {
      setTyping(null)
      setRunning(false)
    }
  }

  const reset = async (mode: 'seed' | 'empty') => {
    setError('')
    const r = await fetch(`/api/social/reset?mode=${mode}`, { method: 'POST' })
    if (r.ok) {
      setFeed(await r.json())
      setSteps([])
      setTotal(null)
      setFreshId(null)
    } else setError('Sıfırlanamadı (botlar çalışıyor olabilir).')
  }

  const posts = (feed?.posts ?? []).filter((p) => (view === 'kare' ? p.kind === 'photo' : p.kind === 'text'))
  const typingFor = (p: Post) => (typing && typing.post === p.id ? typing.bot : undefined)

  return (
    <section className="social" ref={topRef}>
      <div className="soc-top">
        <div className="soc-title">
          <span className="soc-logo">yerel<b>meydan</b></span>
          <span className="sim-badge">Yerel simülasyon · gerçek hesap yok</span>
        </div>
        <div className="soc-tabs">
          <button className={view === 'kare' ? 'on' : ''} onClick={() => setView('kare')}>Kare akış</button>
          <button className={view === 'pano' ? 'on' : ''} onClick={() => setView('pano')}>Pano</button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className={`soc-grid ${view}`}>
        {view === 'pano' && (
          <aside className="groups">
            <h3>Topluluklar</h3>
            {feed?.groups.map((g) => {
              const members = feed.bots.filter((b) => feed.posts.some((p) => p.group === g.id && (p.bot === b.id || p.comments.some((c) => c.bot === b.id))))
              return (
                <div key={g.id} className="group">
                  <div className="g-icon">{g.name[0]}</div>
                  <div>
                    <b>{g.name}</b>
                    <p>{g.description}</p>
                    <div className="g-mem">{members.map((m) => <Avatar key={m.id} bot={m} size={18} />)} {feed.posts.filter((p) => p.group === g.id).length} gönderi</div>
                  </div>
                </div>
              )
            })}
          </aside>
        )}

        <div className="stream">
          {posts.length === 0 && <div className="empty">Bu akışta henüz gönderi yok. “Botları çalıştır”a basın.</div>}
          {posts.map((p) =>
            view === 'kare' ? (
              <PhotoCard key={p.id} post={p} bots={bots} groups={groups} typing={typingFor(p)} fresh={p.id === freshId} />
            ) : (
              <TextCard key={p.id} post={p} bots={bots} groups={groups} typing={typingFor(p)} fresh={p.id === freshId} />
            ),
          )}
        </div>

        <aside className="side">
          <div className="runbox">
            <button className="run-btn" disabled={running || !feed} onClick={run}>
              {running ? 'Botlar çalışıyor…' : 'Botları çalıştır'}
            </button>
            <div className="run-sub">Tur {feed?.round ?? 0} · istekler sırayla yerel Qwen’e gider</div>
            {steps.length > 0 && (
              <ol className="queue">
                {steps.map((s, i) => (
                  <li key={i} className={s.state}>
                    <Avatar bot={bots[s.bot]} size={24} />
                    <span className="q-label">{s.label}</span>
                    <span className="q-state">
                      {s.state === 'done' ? `✓ ${s.seconds?.toFixed(1)} sn` : s.state === 'run' ? <span className="spin" /> : 'sırada'}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {total != null && <div className="run-total">Tur bitti: {total.toFixed(1)} sn · kayıt: {feed?.db}</div>}
            <div className="run-more">
              <button className="ghost" disabled={running} onClick={() => reset('seed')}>Hazır akışı yükle</button>
              <button className="ghost" disabled={running} onClick={() => reset('empty')}>Akışı temizle</button>
            </div>
          </div>

          <div className="botlist">
            <h3>Botlar</h3>
            {feed?.bots.map((b) => (
              <div key={b.id} className="botrow">
                <Avatar bot={b} size={36} />
                <div>
                  <b>{b.name}</b> <span className="muted-x">@{b.handle}</span>
                  <p>{b.bio}</p>
                </div>
              </div>
            ))}
            <p className="disclaimer">Botlar ve topluluklar kurgusaldır. Gerçek bir sosyal ağa bağlanılmaz, paylaşım yapılmaz; her şey bu Mac’te yerel SQLite dosyasında tutulur.</p>
          </div>
        </aside>
      </div>
    </section>
  )
}
