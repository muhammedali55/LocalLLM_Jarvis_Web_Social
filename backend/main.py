"""Yerel İnternet backend'i. Yalnızca 127.0.0.1'e bağlanır."""
import logging
import time

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field

from . import config, jarvis, llm, search, social, speech

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s", datefmt="%H:%M:%S")

app = FastAPI(title="Yerel İnternet", docs_url=None, redoc_url=None, openapi_url=None)

MAX_AUDIO_BYTES = 25 * 1024 * 1024

@app.get("/api/health")
async def health():
    llm_s = await llm.status()
    sp = await speech.status()
    return {"ok": llm_s["ok"] and sp["asr"]["ok"] and sp["tts"]["ok"], "llm": llm_s, **sp,
            "backend": f"http://{config.BACKEND_HOST}:{config.BACKEND_PORT}"}


class Turn(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(max_length=4000)


@app.post("/api/jarvis/transcribe")
async def jarvis_transcribe(audio: UploadFile = File(...)):
    data = await audio.read()
    if not data:
        raise HTTPException(400, "Boş ses kaydı.")
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(413, "Ses kaydı çok uzun.")
    try:
        res = await speech.transcribe(data, audio.filename or "kayit.webm")
    except speech.SpeechError as e:
        raise HTTPException(503, str(e))
    finally:
        del data
    res["text"], res["ignored"] = jarvis.filter_transcript(res["text"])
    res["stop"] = not res["ignored"] and jarvis.is_stop_command(res["text"])
    return res


class StreamBody(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    history: list[Turn] = Field(default_factory=list, max_length=12)


@app.post("/api/jarvis/stream")
async def jarvis_stream(body: StreamBody):
    history = [t.model_dump() for t in body.history]
    return StreamingResponse(jarvis.stream_reply(body.text, history), media_type="application/x-ndjson",
                             headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"})


# ---------- Demo 1: yerel arama ----------

@app.get("/api/search")
async def search_results(q: str = Query(min_length=1, max_length=300)):
    t0 = time.perf_counter()
    results = await search.INDEX.search(q, k=3)
    return {"query": q, "results": results, "total_docs": len(search.INDEX.docs),
            "seconds": round(time.perf_counter() - t0, 2)}


class SearchAnswerBody(BaseModel):
    q: str = Field(min_length=1, max_length=300)
    ids: list[str] = Field(min_length=1, max_length=5)


@app.post("/api/search/answer")
async def search_answer(body: SearchAnswerBody):
    """Yerel belgeler soruyla güçlü eşleşirse onlara dayanır; yoksa Qwen'in kendi (internetsiz) bilgisiyle cevaplar."""
    hits = {h["id"]: h for h in await search.INDEX.search(body.q, k=5)}
    docs = [d for i in body.ids if (d := search.INDEX.get(i)) and i in hits and search.is_strong(hits[i])]
    try:
        if docs:
            res = await llm.chat(search.build_messages(body.q, docs), temperature=0.2, max_tokens=350)
            if not search.looks_not_found(res["text"]):
                res["mode"] = "local"
                res["used_ids"] = [d.id for d in docs]
                res["found"] = True
                return res
        res = await llm.chat(search.general_messages(body.q), temperature=0.3, max_tokens=450)
    except llm.LLMError as e:
        raise HTTPException(503, str(e))
    res["mode"] = "general"
    res["used_ids"] = []
    res["found"] = True
    return res


@app.get("/api/search/doc/{doc_id}")
async def search_doc(doc_id: str):
    await search.INDEX.ensure()
    d = search.INDEX.get(doc_id)
    if not d:
        raise HTTPException(404, "Belge bulunamadı.")
    return {"id": d.id, "title": d.title, "source": d.source, "path": d.path, "tags": d.tags, "body": d.body}


# ---------- Demo 2: yerel bot sosyal simülasyonu ----------

@app.get("/api/social/feed")
async def social_feed():
    return social.feed()


@app.post("/api/social/run")
async def social_run():
    return StreamingResponse(social.run_round(), media_type="application/x-ndjson",
                             headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"})


@app.post("/api/social/reset")
async def social_reset(mode: str = Query("seed", pattern="^(seed|empty)$")):
    if social.RUN_LOCK.locked():
        raise HTTPException(409, "Botlar çalışırken sıfırlanamaz.")
    social.reset(mode)
    return social.feed()


class TTSBody(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


@app.post("/api/tts")
async def tts(body: TTSBody):
    try:
        wav = await speech.synthesize(body.text)
    except speech.SpeechError as e:
        raise HTTPException(503, str(e))
    return Response(wav, media_type="audio/wav", headers={"Cache-Control": "no-store"})
