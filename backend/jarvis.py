"""Jarvis sesli sohbet: transkript süzme, yerel not yönlendirme ve cümle cümle akış."""
import json
import logging
import re
import time

from . import llm, search

log = logging.getLogger("yerel.jarvis")

SYSTEM = (
    "Sen Jarvis'sin: bu MacBook'ta tamamen yerel ve internetsiz çalışan, Türkçe konuşan kişisel bir sesli asistansın. "
    "Kullanıcıyla sesli ve karşılıklı sohbet ediyorsun; cevapların doğrudan sesli okunacak, ekranda yazı gösterilmeyecek. "
    "Bu yüzden en fazla 2-3 kısa cümleyle, sıcak ve doğal konuşma dilinde cevap ver. İlk cümlen kısa olsun. "
    "Madde işareti, başlık, emoji, parantez, kod veya markdown kullanma. Kısaltma ve sembol yerine kelimeyi yaz. "
    "İnternete erişimin yok; güncel haber, hava durumu, döviz gibi canlı bilgileri bilemezsin, sorulursa bunu dürüstçe söyle. "
    "Emin olmadığın bilgiyi uydurma."
)

NOTES_HINT = (
    "Aşağıda bu bilgisayardaki yerel notlardan soruyla ilgili olabilecek bölümler var. "
    "Soruyla ilgiliyse cevabını bunlara dayandır ve 'yerel notlarına göre' gibi kısaca belirt; "
    "ilgisizse yok say.\n\n"
)

# Whisper'ın sessizlik/gürültüde sık uydurduğu Türkçe kalıplar
_HALLUCINATIONS = re.compile(
    r"altyaz[ıi]|izledi[gğ]iniz i[cç]in|abone ol|teşekkürler\.?$|m\.k\.|www\.|\.com|"
    r"^\W*$|^(hm+|ı+h*|e+h*|a+h*)\W*$",
    re.I,
)

# Oturumu kapatma komutları
_STOP = re.compile(
    r"\b(kapat|kapan|dur(dur)?|sus|g[oö]r[uü]ş[uü]r[uü]z|ho[sş][cç]a ?kal|bitir|yeter|g[uü]le g[uü]le|"
    r"[cç]ık[ıi][sş] yap|uyku moduna ge[cç])\b",
    re.I,
)


def filter_transcript(text: str) -> tuple[str, bool]:
    """(temiz metin, yok sayılmalı mı)"""
    t = re.sub(r"\s+", " ", text).strip().strip("-–—").strip()
    if len(t) < 2 or _HALLUCINATIONS.search(t):
        return t, True
    return t, False


def is_stop_command(text: str) -> bool:
    words = text.split()
    # Kısa cümlelerde kapanış sözcüğü geçiyorsa (ör. "Tamam Jarvis kapat") oturumu bitir
    return len(words) <= 6 and bool(_STOP.search(text))


_SENT_END = re.compile(r"(.+?[.!?…])(\s+|$)", re.S)


def _split_ready(buf: str, final: bool, first: bool = False) -> tuple[list[str], str]:
    out = []
    # İlk parçayı virgülden erken gönder: ses daha çabuk başlasın
    if first and not final:
        m = re.match(r"(.{30,120}?,)\s", buf, re.S)
        if m and not re.search(r"[.!?…]", m.group(1)):
            return [m.group(1).strip()], buf[m.end():]
    while True:
        m = _SENT_END.match(buf)
        if not m or (m.end() == len(buf) and not final and not m.group(2)):
            break
        s = m.group(1).strip()
        buf = buf[m.end():]
        if s:
            out.append(s)
    # Çok uzun cümleyi virgülden böl (sesin daha erken başlaması için)
    if len(buf) > 160:
        i = buf.rfind(",", 0, 160)
        if i > 40:
            out.append(buf[: i + 1].strip())
            buf = buf[i + 1:]
    if final and buf.strip():
        out.append(buf.strip())
        buf = ""
    return out, buf


async def stream_reply(text: str, history: list[dict]):
    """NDJSON olay akışı: route → sentence* → done (veya error)."""
    t0 = time.perf_counter()
    mode, notes = "chat", []
    try:
        hits = await search.INDEX.search(text, k=2)
        # Yalnızca güçlü eşleşmede yerel notları kullan
        notes = [h for h in hits if h["score"] >= 0.9 and h["semantic"] >= 0.62]
    except Exception as e:  # arama yoksa sohbetle devam
        log.warning("yerel not araması atlandı: %s", e)
    if notes:
        mode = "search"
    yield _ev(type="route", mode=mode, sources=[{"title": n["title"], "path": n["path"]} for n in notes])

    messages = [{"role": "system", "content": SYSTEM}]
    messages += history[-6:]
    if notes:
        docs = [search.INDEX.get(n["id"]) for n in notes]
        ctx = "\n\n".join(f"[{d.title}]\n{d.body}" for d in docs if d)
        messages.append({"role": "user", "content": f"{NOTES_HINT}{ctx}\n\nSoru: {text}"})
    else:
        messages.append({"role": "user", "content": text})

    buf, full, first = "", "", None
    try:
        async for piece in llm.chat_stream(messages, temperature=0.6, max_tokens=220):
            buf += piece
            full += piece
            ready, buf = _split_ready(buf, final=False, first=first is None)
            for s in ready:
                first = first or time.perf_counter() - t0
                yield _ev(type="sentence", text=s)
        ready, _ = _split_ready(buf, final=True)
        for s in ready:
            first = first or time.perf_counter() - t0
            yield _ev(type="sentence", text=s)
    except llm.LLMError as e:
        yield _ev(type="error", message=str(e))
        return
    total = time.perf_counter() - t0
    log.info("jarvis yanıtı: ilk cümle %.2f sn, toplam %.2f sn, mod=%s", first or 0, total, mode)
    yield _ev(type="done", text=full.strip(), first_sentence_s=round(first or 0, 2), total_s=round(total, 2))


def _ev(**kw) -> str:
    return json.dumps(kw, ensure_ascii=False) + "\n"
