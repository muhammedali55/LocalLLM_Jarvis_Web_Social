// Jarvis sürekli konuşma döngüsü — tamamen yerel.
// Mikrofon → (tarayıcıda enerji tabanlı sessizlik algılama) → 16 kHz WAV → yerel whisper.cpp
// → yerel Qwen (cümle cümle akış) → yerel TTS → çalma → tekrar dinleme.
// Jarvis konuşurken mikrofon yok sayılır (kendi sesini duymasın diye yarı-çift yönlü).

export type Phase =
  | 'idle' // hazır, oturum kapalı
  | 'listening' // dinliyor, konuşma bekliyor
  | 'hearing' // kullanıcı konuşuyor
  | 'transcribing' // ses yazıya çevriliyor
  | 'thinking' // Qwen düşünüyor
  | 'searching' // yerel notlarda arıyor
  | 'speaking' // cevaplıyor
  | 'done' // oturum bitti
  | 'error'

export type Turn = { role: 'user' | 'assistant'; content: string }

export type LoopEvents = {
  phase: (p: Phase, info?: { notes?: number; error?: string }) => void
}

const VAD = {
  frameMs: 20,
  prerollMs: 350,
  startFrames: 4, // ~80 ms konuşma → başladı say
  endSilenceMs: 850, // bu kadar sessizlik → bitti say
  minSpeechMs: 350,
  maxUtteranceMs: 30000,
  minAbs: 0.010,
  startRatio: 3.2,
  keepRatio: 2.0,
  resumeGuardMs: 350, // Jarvis susunca kuyruk yankısını yok say
}

const WORKLET = `
class Cap extends AudioWorkletProcessor {
  process(inputs){
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor('jarvis-cap', Cap);
`

function encodeWav16k(chunks: Float32Array[], srcRate: number): Blob {
  const total = chunks.reduce((n, c) => n + c.length, 0)
  const ratio = srcRate / 16000
  const outLen = Math.floor(total / ratio)
  const pcm = new Int16Array(outLen)
  // Basit ortalama ile alt örnekleme
  let ci = 0, off = 0, acc = 0, cnt = 0, oi = 0, next = ratio, pos = 0
  while (oi < outLen && ci < chunks.length) {
    const c = chunks[ci]
    acc += c[off]
    cnt++
    pos++
    if (pos >= next) {
      const v = Math.max(-1, Math.min(1, acc / cnt))
      pcm[oi++] = v < 0 ? v * 0x8000 : v * 0x7fff
      acc = 0
      cnt = 0
      next += ratio
    }
    if (++off >= c.length) { off = 0; ci++ }
  }
  const buf = new ArrayBuffer(44 + pcm.byteLength)
  const v = new DataView(buf)
  const w = (o: number, s: string) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)))
  w(0, 'RIFF'); v.setUint32(4, 36 + pcm.byteLength, true); w(8, 'WAVE'); w(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, 16000, true); v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  w(36, 'data'); v.setUint32(40, pcm.byteLength, true)
  new Int16Array(buf, 44).set(pcm)
  return new Blob([buf], { type: 'audio/wav' })
}

async function apiError(r: Response) {
  try {
    const j = await r.json()
    return typeof j.detail === 'string' ? j.detail : `Yerel servis hatası (${r.status})`
  } catch {
    return `Yerel servis hatası (${r.status})`
  }
}

export class VoiceLoop {
  phase: Phase = 'idle'
  ctx: AudioContext | null = null
  micAnalyser: AnalyserNode | null = null
  outAnalyser: AnalyserNode | null = null
  private stream: MediaStream | null = null
  private node: AudioWorkletNode | null = null
  private session = 0
  private history: Turn[] = []
  private ev: LoopEvents

  // VAD durumu
  private floor = 0.004
  private ring: Float32Array[] = []
  private utter: Float32Array[] = []
  private voicedRun = 0
  private silentMs = 0
  private speechMs = 0
  private uttMs = 0
  private acceptMicAt = 0
  private frameAcc: Float32Array[] = []
  private frameLen = 0
  private sources = new Set<AudioBufferSourceNode>()

  constructor(ev: LoopEvents) {
    this.ev = ev
  }

  get active() {
    return this.session > 0 && this.phase !== 'idle' && this.phase !== 'done'
  }

  private set(p: Phase, info?: { notes?: number; error?: string }) {
    this.phase = p
    this.ev.phase(p, info)
  }

  async start() {
    if (this.active) return
    const id = ++this.session
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      })
    } catch {
      this.set('error', { error: 'Mikrofon izni verilmedi. Adres çubuğundaki simgeden mikrofona izin verin.' })
      return
    }
    if (id !== this.session) return this.releaseMic()
    const ctx = this.ctx ?? new AudioContext({ latencyHint: 'interactive' })
    this.ctx = ctx
    await ctx.resume()
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' }))
    try {
      await ctx.audioWorklet.addModule(url)
    } catch {
      /* zaten yüklü */
    }
    URL.revokeObjectURL(url)
    const src = ctx.createMediaStreamSource(this.stream)
    this.micAnalyser = ctx.createAnalyser()
    this.micAnalyser.fftSize = 1024
    src.connect(this.micAnalyser)
    this.node = new AudioWorkletNode(ctx, 'jarvis-cap')
    src.connect(this.node)
    this.node.port.onmessage = (e) => this.onSamples(e.data as Float32Array, id)
    if (!this.outAnalyser) {
      this.outAnalyser = ctx.createAnalyser()
      this.outAnalyser.fftSize = 1024
      this.outAnalyser.connect(ctx.destination)
    }
    this.history = []
    this.resetVad()
    this.chime([660, 990])
    this.acceptMicAt = performance.now() + 250
    this.set('listening')
  }

  stop(silent = false) {
    if (this.session === 0) return
    this.session++
    this.stopPlayback()
    this.releaseMic()
    if (!silent) this.chime([880, 440])
    this.set('done')
    setTimeout(() => this.phase === 'done' && this.set('idle'), 2200)
  }

  private releaseMic() {
    this.node?.port.close()
    this.node?.disconnect()
    this.node = null
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    this.micAnalyser = null
  }

  private stopPlayback() {
    this.sources.forEach((s) => {
      try { s.stop() } catch { /* */ }
    })
    this.sources.clear()
  }

  private resetVad() {
    this.ring = []
    this.utter = []
    this.voicedRun = 0
    this.silentMs = 0
    this.speechMs = 0
    this.uttMs = 0
  }

  // ---- Sessizlik algılama ----
  private onSamples(chunk: Float32Array, id: number) {
    if (id !== this.session || !this.ctx) return
    this.frameAcc.push(chunk)
    this.frameLen += chunk.length
    const need = (this.ctx.sampleRate * VAD.frameMs) / 1000
    if (this.frameLen < need) return
    const frame = new Float32Array(this.frameLen)
    let o = 0
    for (const c of this.frameAcc) { frame.set(c, o); o += c.length }
    this.frameAcc = []
    this.frameLen = 0
    this.onFrame(frame)
  }

  private onFrame(frame: Float32Array) {
    const listening = this.phase === 'listening' || this.phase === 'hearing'
    if (!listening || performance.now() < this.acceptMicAt) {
      this.ring = []
      return
    }
    let sum = 0
    for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i]
    const rms = Math.sqrt(sum / frame.length)
    const startT = Math.max(VAD.minAbs, this.floor * VAD.startRatio)
    const keepT = Math.max(VAD.minAbs * 0.7, this.floor * VAD.keepRatio)

    if (this.phase === 'listening') {
      // Gürültü tabanını yavaşça izle
      this.floor = rms < this.floor ? this.floor * 0.9 + rms * 0.1 : this.floor * 0.995 + rms * 0.005
      this.ring.push(frame)
      const maxRing = Math.ceil(VAD.prerollMs / VAD.frameMs)
      while (this.ring.length > maxRing) this.ring.shift()
      this.voicedRun = rms > startT ? this.voicedRun + 1 : 0
      if (this.voicedRun >= VAD.startFrames) {
        this.utter = [...this.ring]
        this.ring = []
        this.speechMs = this.voicedRun * VAD.frameMs
        this.uttMs = this.utter.length * VAD.frameMs
        this.silentMs = 0
        this.set('hearing')
      }
      return
    }

    // hearing
    this.utter.push(frame)
    this.uttMs += VAD.frameMs
    if (rms > keepT) {
      this.silentMs = 0
      this.speechMs += VAD.frameMs
    } else {
      this.silentMs += VAD.frameMs
    }
    if (this.silentMs >= VAD.endSilenceMs || this.uttMs >= VAD.maxUtteranceMs) {
      const chunks = this.utter
      const speech = this.speechMs
      this.resetVad()
      if (speech < VAD.minSpeechMs) {
        this.set('listening')
        return
      }
      this.handleUtterance(chunks)
    }
  }

  // ---- Bir konuşma turu ----
  private async handleUtterance(chunks: Float32Array[]) {
    const id = this.session
    const ctx = this.ctx!
    this.set('transcribing')
    this.chime([520], 0.05)
    const wav = encodeWav16k(chunks, ctx.sampleRate)
    let text = ''
    try {
      const fd = new FormData()
      fd.append('audio', wav, 'konusma.wav')
      const r = await fetch('/api/jarvis/transcribe', { method: 'POST', body: fd })
      if (!r.ok) throw new Error(await apiError(r))
      const t = await r.json()
      if (id !== this.session) return
      if (t.ignored || !t.text) return this.backToListening()
      if (t.stop) {
        await this.say(['Görüşmek üzere.'], id)
        if (id === this.session) this.stop()
        return
      }
      text = t.text
    } catch (e) {
      return this.fail(e, id)
    }

    this.set('thinking')
    try {
      const r = await fetch('/api/jarvis/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, history: this.history }),
      })
      if (!r.ok || !r.body) throw new Error(await apiError(r))
      const queue: Promise<AudioBuffer | null>[] = []
      let streamDone = false
      let answer = ''
      const player = this.playQueue(queue, () => streamDone, id)
      const reader = r.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        if (id !== this.session) { reader.cancel(); return }
        buf += dec.decode(value, { stream: true })
        let nl
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl)
          buf = buf.slice(nl + 1)
          if (!line.trim()) continue
          const e = JSON.parse(line)
          if (e.type === 'route' && e.mode === 'search' && this.phase === 'thinking') {
            this.set('searching', { notes: e.sources.length })
          } else if (e.type === 'sentence') {
            queue.push(this.synth(e.text))
          } else if (e.type === 'done') {
            answer = e.text
          } else if (e.type === 'error') {
            throw new Error(e.message)
          }
        }
      }
      streamDone = true
      await player
      if (id !== this.session) return
      this.history.push({ role: 'user', content: text }, { role: 'assistant', content: answer })
      this.history = this.history.slice(-8)
      this.backToListening()
    } catch (e) {
      this.fail(e, id)
    }
  }

  private backToListening() {
    this.acceptMicAt = performance.now() + VAD.resumeGuardMs
    this.resetVad()
    this.set('listening')
  }

  private fail(e: unknown, id: number) {
    if (id !== this.session) return
    const msg = e instanceof TypeError ? 'Yerel backend kapalı görünüyor (127.0.0.1:8765).' : (e as Error).message
    this.set('error', { error: msg })
    setTimeout(() => id === this.session && this.phase === 'error' && this.backToListening(), 4000)
  }

  private async synth(text: string): Promise<AudioBuffer | null> {
    const r = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!r.ok) throw new Error(await apiError(r))
    return this.ctx!.decodeAudioData(await r.arrayBuffer())
  }

  private async playQueue(queue: Promise<AudioBuffer | null>[], streamDone: () => boolean, id: number) {
    let i = 0
    for (;;) {
      if (id !== this.session) return
      if (i < queue.length) {
        const buf = await queue[i++]
        if (!buf || id !== this.session) continue
        if (this.phase !== 'speaking') this.set('speaking')
        await this.play(buf)
      } else if (streamDone()) {
        return
      } else {
        await new Promise((r) => setTimeout(r, 30))
      }
    }
  }

  private play(buf: AudioBuffer): Promise<void> {
    const ctx = this.ctx!
    return new Promise((resolve) => {
      const s = ctx.createBufferSource()
      s.buffer = buf
      s.connect(this.outAnalyser!)
      s.onended = () => {
        this.sources.delete(s)
        resolve()
      }
      this.sources.add(s)
      s.start()
    })
  }

  private async say(lines: string[], id: number) {
    this.set('speaking')
    for (const l of lines) {
      try {
        const b = await this.synth(l)
        if (b && id === this.session) await this.play(b)
      } catch { /* */ }
    }
  }

  // Kısa yerel bip sesleri (dosya yok, osilatör)
  private chime(freqs: number[], gain = 0.08) {
    const ctx = this.ctx
    if (!ctx) return
    let t = ctx.currentTime
    for (const f of freqs) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = f
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(gain, t + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
      o.connect(g).connect(ctx.destination)
      o.start(t)
      o.stop(t + 0.18)
      t += 0.09
    }
  }
}
