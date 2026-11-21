"""Yerel Qwen istemcisi (Ollama, 127.0.0.1). Prompt içeriği loglanmaz."""
import json
import logging
import time

import httpx

from . import config

log = logging.getLogger("yerel.llm")


class LLMError(RuntimeError):
    pass


async def chat(messages: list[dict], *, temperature: float = 0.7, max_tokens: int = 400,
               fmt: dict | str | None = None, seed: int | None = None) -> dict:
    payload = {
        "model": config.QWEN_MODEL,
        "messages": messages,
        "stream": False,
        "think": False,
        "keep_alive": config.OLLAMA_KEEP_ALIVE,
        "options": {"temperature": temperature, "num_predict": max_tokens},
    }
    if fmt is not None:
        payload["format"] = fmt
    if seed is not None:
        payload["options"]["seed"] = seed
    t0 = time.perf_counter()
    log.info("-> yerel Ollama %s/api/chat model=%s", config.OLLAMA_URL, config.QWEN_MODEL)
    try:
        async with httpx.AsyncClient(timeout=180) as client:
            r = await client.post(f"{config.OLLAMA_URL}/api/chat", json=payload)
            r.raise_for_status()
    except httpx.ConnectError as e:
        raise LLMError("Yerel Ollama servisine bağlanılamadı (127.0.0.1:11434). Ollama açık mı?") from e
    except httpx.HTTPStatusError as e:
        raise LLMError(f"Yerel Ollama hata döndürdü: {e.response.status_code} {e.response.text[:200]}") from e
    data = r.json()
    elapsed = time.perf_counter() - t0
    eval_count = data.get("eval_count") or 0
    eval_dur = (data.get("eval_duration") or 0) / 1e9
    log.info("<- yerel Ollama cevap: %.2f sn, %d token", elapsed, eval_count)
    return {
        "text": data["message"]["content"].strip(),
        "model": config.QWEN_MODEL,
        "seconds": round(elapsed, 2),
        "tokens": eval_count,
        "tokens_per_sec": round(eval_count / eval_dur, 1) if eval_dur else None,
    }


async def chat_stream(messages: list[dict], *, temperature: float = 0.7, max_tokens: int = 400):
    """Yerel Ollama'dan token token akış; her parça metin olarak döner."""
    payload = {
        "model": config.QWEN_MODEL,
        "messages": messages,
        "stream": True,
        "think": False,
        "keep_alive": config.OLLAMA_KEEP_ALIVE,
        "options": {"temperature": temperature, "num_predict": max_tokens},
    }
    log.info("-> yerel Ollama %s/api/chat (akış) model=%s", config.OLLAMA_URL, config.QWEN_MODEL)
    try:
        async with httpx.AsyncClient(timeout=180) as client:
            async with client.stream("POST", f"{config.OLLAMA_URL}/api/chat", json=payload) as r:
                if r.status_code != 200:
                    raise LLMError(f"Yerel Ollama hata döndürdü: {r.status_code}")
                async for line in r.aiter_lines():
                    if not line:
                        continue
                    data = json.loads(line)
                    piece = data.get("message", {}).get("content", "")
                    if piece:
                        yield piece
                    if data.get("done"):
                        log.info("<- yerel Ollama akış bitti: %d token", data.get("eval_count", 0))
                        return
    except httpx.ConnectError as e:
        raise LLMError("Yerel Ollama servisine bağlanılamadı (127.0.0.1:11434). Ollama açık mı?") from e


async def status() -> dict:
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            v = (await client.get(f"{config.OLLAMA_URL}/api/version")).json()
            tags = (await client.get(f"{config.OLLAMA_URL}/api/tags")).json()
        names = [m["name"] for m in tags.get("models", [])]
        present = any(n.split(":")[0] == config.QWEN_MODEL.split(":")[0] for n in names)
        return {"ok": present, "runner": f"Ollama {v.get('version')}", "url": config.OLLAMA_URL,
                "model": config.QWEN_MODEL, "model_present": present}
    except Exception:
        return {"ok": False, "runner": "Ollama", "url": config.OLLAMA_URL,
                "model": config.QWEN_MODEL, "model_present": False,
                "error": "Ollama'ya ulaşılamıyor"}
