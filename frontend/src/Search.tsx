import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { getDoc, searchAnswer, searchLocal, type LocalDoc, type SearchAnswer, type SearchResults } from './api'

const EXAMPLES = [
  'Yerel yapay zekâ internetsiz nasıl çalışır?',
  'Albert Einstein kimdir?',
  'Quantization nedir?',
  'Fotosentez nedir?',
  'Kuzey X1 bulaşık makinesinde yıkanır mı?',
]

// [1] gibi kaynak atıflarını küçük rozetlere çevirir
function withCitations(text: string, onCite: (n: number) => void): ReactNode[] {
  return text.split(/(\[\d\])/g).map((part, i) => {
    const m = part.match(/^\[(\d)\]$/)
    return m ? (
      <button key={i} className="cite" onClick={() => onCite(Number(m[1]))}>{m[1]}</button>
    ) : (
      <span key={i}>{part}</span>
    )
  })
}

export default function Search() {
  const [q, setQ] = useState('')
  const [submitted, setSubmitted] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [answer, setAnswer] = useState<SearchAnswer | null>(null)
  const [loadingAnswer, setLoadingAnswer] = useState(false)
  const [error, setError] = useState('')
  const [doc, setDoc] = useState<LocalDoc | null>(null)
  const [flash, setFlash] = useState<number | null>(null)
  const runId = useRef(0)

  const run = async (query: string) => {
    const text = query.trim()
    if (!text) return
    const id = ++runId.current
    setQ(text)
    setSubmitted(text)
    setError('')
    setAnswer(null)
    setResults(null)
    setLoadingAnswer(true)
    try {
      const r = await searchLocal(text)
      if (id !== runId.current) return
      setResults(r)
      const a = await searchAnswer(text, r.results.map((x) => x.id))
      if (id !== runId.current) return
      setAnswer(a)
    } catch (e) {
      if (id === runId.current) setError((e as Error).message)
    } finally {
      if (id === runId.current) setLoadingAnswer(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    run(q)
  }

  const openDoc = async (id: string) => {
    try {
      setDoc(await getDoc(id))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  // [n] atfı, Qwen'e verilen n. yerel belgeyi gösterir → o belgenin kartını vurgula
  const cite = (n: number) => {
    const id = answer?.used_ids[n - 1]
    const idx = results?.results.findIndex((r) => r.id === id) ?? -1
    if (idx < 0) return
    setFlash(idx + 1)
    document.getElementById(`hit-${idx + 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => setFlash(null), 1200)
  }
  const general = answer?.mode === 'general'

  const home = !submitted

  const form = (
    <form className={`search-box ${home ? 'big' : ''}`} onSubmit={onSubmit} role="search">
      <svg viewBox="0 0 24 24" className="search-icon" aria-hidden="true">
        <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Bir şey sor… (internet kapalı olsa da)"
        autoFocus
        aria-label="Arama"
      />
      {q && (
        <button type="button" className="clear" onClick={() => setQ('')} aria-label="Temizle">×</button>
      )}
      <button type="submit" className="go" disabled={!q.trim() || loadingAnswer}>Ara</button>
    </form>
  )

  return (
    <section className={`search ${home ? 'home' : 'results'}`}>
      {home ? (
        <div className="search-home">
          <div className="wordmark">
            <span>yerel</span><b>ara</b>
          </div>
          {form}
          <div className="local-tag">Yerel demo verileri + Qwen’in kendi bilgisi · web araması yapılmaz</div>
          <div className="chips">
            {EXAMPLES.map((x) => (
              <button key={x} className="chip" onClick={() => run(x)}>{x}</button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="search-top">
            <button className="wordmark small" onClick={() => { setSubmitted(''); setResults(null); setAnswer(null) }}>
              <span>yerel</span><b>ara</b>
            </button>
            {form}
          </div>
          <div className="meta-line">
            <span className="local-tag">Yerel demo verileri</span>
            {results && <span>{results.total_docs} yerel belge tarandı · {results.seconds} sn</span>}
          </div>

          {error && <div className="error">{error}</div>}

          <div className={`ai-answer ${general ? 'general' : ''}`}>
            <div className="ai-head">
              <span className="ai-dot" /> Qwen yanıtı · bu Mac’te
              {answer && <em>· {answer.model} · {answer.seconds} sn</em>}
              {answer && (
                <span className={`src-chip ${general ? 'gen' : 'loc'}`}>
                  {general ? 'Modelin kendi bilgisi · internet yok' : `Yerel belgelerden · ${answer.used_ids.length} kaynak`}
                </span>
              )}
            </div>
            {loadingAnswer ? (
              <div className="skeleton">
                <span /><span /><span />
                <div className="muted small">Qwen yerel kaynakları okuyup yanıt yazıyor…</div>
              </div>
            ) : answer ? (
              <p>{general ? answer.text : withCitations(answer.text, cite)}</p>
            ) : null}
            {answer && general && (
              <div className="muted small">Bu cevap internetten değil, Qwen modelinin eğitimde öğrendiği bilgiden geliyor; güncel olmayabilir veya hata içerebilir.</div>
            )}
          </div>

          {results && (
            <>
              <h2 className="hits-title">{general ? 'Yerel belgelerde eşleşme yok · en yakın belgeler' : 'Yerel kaynaklar'}</h2>
              <ol className="hits">
                {results.results.map((r, i) => (
                  <li key={r.id} id={`hit-${i + 1}`} className={`hit ${flash === i + 1 ? 'flash' : ''} ${general ? 'dim' : ''} ${answer?.used_ids.includes(r.id) ? 'used' : ''}`}>
                    <div className="hit-src">
                      <span className="num">{i + 1}</span>
                      <span className="src-name">{r.source}</span>
                      <span className="src-path">{r.path}</span>
                    </div>
                    <button className="hit-title" onClick={() => openDoc(r.id)}>{r.title}</button>
                    <p className="hit-snippet">{r.snippet}</p>
                  </li>
                ))}
              </ol>
            </>
          )}
        </>
      )}

      {doc && (
        <div className="modal" onClick={() => setDoc(null)}>
          <article className="doc" onClick={(e) => e.stopPropagation()}>
            <div className="hit-src">
              <span className="src-name">{doc.source}</span>
              <span className="src-path">{doc.path}</span>
            </div>
            <h3>{doc.title}</h3>
            {doc.body.split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>)}
            <div className="row">
              <button className="ghost" onClick={() => setDoc(null)}>Kapat</button>
            </div>
          </article>
        </div>
      )}
    </section>
  )
}
