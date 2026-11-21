// Bütün istekler aynı kaynağa (/api → 127.0.0.1:8765) gider. Dış servis yok.

export type Health = {
  ok: boolean
  llm: { ok: boolean; runner: string; model: string; model_present: boolean; error?: string }
  asr: { ok: boolean; engine: string; model: string; model_present: boolean }
  tts: { ok: boolean; engine: string; voice: string }
}

export type Answer = { text: string; model: string; seconds: number; tokens: number; tokens_per_sec: number | null }

async function errorText(r: Response): Promise<string> {
  try {
    const j = await r.json()
    return typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail)
  } catch {
    return `Yerel servis hatası (${r.status})`
  }
}

async function call(input: string, init?: RequestInit): Promise<Response> {
  let r: Response
  try {
    r = await fetch(input, init)
  } catch {
    throw new Error('Yerel backend kapalı görünüyor (127.0.0.1:8765). ./start-local.sh ile başlatın.')
  }
  if (!r.ok) throw new Error(await errorText(r))
  return r
}

export const getHealth = async (): Promise<Health> => (await call('/api/health')).json()

// ---------- Demo 1: yerel arama ----------
export type SearchHit = {
  id: string; title: string; source: string; path: string; snippet: string
  score: number; semantic: number; keyword: number
}
export type SearchResults = { query: string; results: SearchHit[]; total_docs: number; seconds: number }
export type SearchAnswer = Answer & { found: boolean; mode: 'local' | 'general'; used_ids: string[] }
export type LocalDoc = { id: string; title: string; source: string; path: string; tags: string; body: string }

export const searchLocal = async (q: string): Promise<SearchResults> =>
  (await call(`/api/search?q=${encodeURIComponent(q)}`)).json()

export async function searchAnswer(q: string, ids: string[]): Promise<SearchAnswer> {
  return (
    await call('/api/search/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q, ids }),
    })
  ).json()
}

export const getDoc = async (id: string): Promise<LocalDoc> =>
  (await call(`/api/search/doc/${encodeURIComponent(id)}`)).json()
