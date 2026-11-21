"""Yerel belge araması: anahtar kelime (BM25) + yerel embedding (Ollama nomic-embed-text).

Belgeler data/search/*.md dosyalarından okunur. Hiçbir dış kaynağa sorgu gönderilmez.
Embedding vektörleri .cache/ altında saklanır; belge değişirse yeniden hesaplanır.
"""
import asyncio
import hashlib
import json
import logging
import math
import re
import time
from dataclasses import dataclass, field

import httpx

from . import config

log = logging.getLogger("yerel.search")

DATA_DIR = config.ROOT / "data" / "search"
CACHE_FILE = config.ROOT / ".cache" / "search-index.json"
EMBED_MODEL = "nomic-embed-text"
NOT_FOUND = "Bu yerel demo verilerinde bulamadım."

STOP = set("ve veya ile bir bu şu o da de mi mı mu mü ne nasıl neden niçin için gibi daha çok en ki ya "
           "ama fakat ise olarak olan olur var yok her hangi kadar sonra önce midir mıdır nedir".split())


@dataclass
class Doc:
    id: str
    title: str
    source: str
    tags: str
    body: str
    path: str
    tokens: list[str] = field(default_factory=list)
    emb: list[float] | None = None


def norm_tr(text: str) -> str:
    text = text.replace("I", "ı").replace("İ", "i").lower()
    return text.translate(str.maketrans("âîû", "aiu"))


def tokenize(text: str) -> list[str]:
    words = re.findall(r"[a-zçğıöşü0-9]+", norm_tr(text))
    # Kaba Türkçe kök: ekleri kırpmak için ilk 5 harf
    return [w[:5] for w in words if w not in STOP and len(w) > 1]


def _parse(path) -> Doc:
    raw = path.read_text(encoding="utf-8")
    meta, body = {}, raw
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", raw, re.S)
    if m:
        for line in m.group(1).splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip()
        body = m.group(2).strip()
    d = Doc(id=path.stem, title=meta.get("title", path.stem), source=meta.get("source", "Yerel belge"),
            tags=meta.get("tags", ""), body=body, path=str(path.relative_to(config.ROOT)))
    # Başlık ve etiketler iki kat ağırlıklı
    d.tokens = tokenize(f"{d.title} {d.title} {d.tags} {d.tags} {d.body}")
    return d


class Index:
    def __init__(self):
        self.docs: list[Doc] = []
        self.df: dict[str, int] = {}
        self.avgdl = 1.0
        self._lock = asyncio.Lock()
        self._sig = ""

    def _signature(self) -> str:
        h = hashlib.sha1()
        for p in sorted(DATA_DIR.glob("*.md")):
            h.update(p.name.encode())
            h.update(p.read_bytes())
        return h.hexdigest()

    async def ensure(self):
        async with self._lock:
            sig = self._signature()
            if sig == self._sig and self.docs:
                return
            t0 = time.perf_counter()
            self.docs = [_parse(p) for p in sorted(DATA_DIR.glob("*.md"))]
            self.df = {}
            for d in self.docs:
                for t in set(d.tokens):
                    self.df[t] = self.df.get(t, 0) + 1
            self.avgdl = sum(len(d.tokens) for d in self.docs) / max(1, len(self.docs))
            await self._embed_docs()
            self._sig = sig
            log.info("yerel indeks hazır: %d belge, %.2f sn", len(self.docs), time.perf_counter() - t0)

    async def _embed_docs(self):
        cache = {}
        if CACHE_FILE.exists():
            try:
                c = json.loads(CACHE_FILE.read_text())
                if c.get("model") == EMBED_MODEL:
                    cache = c.get("docs", {})
            except Exception:
                cache = {}
        todo = []
        for d in self.docs:
            h = hashlib.sha1(f"{d.title}\n{d.tags}\n{d.body}".encode()).hexdigest()
            if cache.get(d.id, {}).get("hash") == h:
                d.emb = cache[d.id]["emb"]
            else:
                todo.append((d, h))
        if todo:
            try:
                vecs = await embed([f"search_document: {d.title}. {d.tags}. {d.body}" for d, _ in todo])
                for (d, h), v in zip(todo, vecs):
                    d.emb = v
                    cache[d.id] = {"hash": h, "emb": v}
                CACHE_FILE.parent.mkdir(exist_ok=True)
                CACHE_FILE.write_text(json.dumps({"model": EMBED_MODEL, "docs": cache}))
            except Exception as e:  # embedding yoksa yalnızca anahtar kelimeyle devam
                log.warning("yerel embedding hesaplanamadı, yalnızca anahtar kelime: %s", e)

    def bm25(self, q: list[str], d: Doc, k1=1.4, b=0.75) -> float:
        n = len(self.docs)
        tf: dict[str, int] = {}
        for t in d.tokens:
            tf[t] = tf.get(t, 0) + 1
        s = 0.0
        for t in set(q):
            if t not in tf:
                continue
            idf = math.log(1 + (n - self.df[t] + 0.5) / (self.df[t] + 0.5))
            s += idf * tf[t] * (k1 + 1) / (tf[t] + k1 * (1 - b + b * len(d.tokens) / self.avgdl))
        return s

    async def search(self, query: str, k: int = 3) -> list[dict]:
        await self.ensure()
        qt = tokenize(query)
        kw = [self.bm25(qt, d) for d in self.docs]
        kw_max = max(kw) or 1.0
        qv = None
        if all(d.emb for d in self.docs):
            try:
                qv = (await embed([f"search_query: {query}"]))[0]
            except Exception as e:
                log.warning("sorgu embedding başarısız: %s", e)
        scored = []
        for d, s_kw in zip(self.docs, kw):
            cos = _cos(qv, d.emb) if qv else 0.0
            scored.append((cos + 0.25 * s_kw / kw_max, cos, s_kw / kw_max, d))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [
            {"id": d.id, "title": d.title, "source": d.source, "path": d.path,
             "snippet": _snippet(d.body, qt), "score": round(total, 3),
             "semantic": round(cos, 3), "keyword": round(kwn, 3)}
            for total, cos, kwn, d in scored[:k]
        ]

    def get(self, doc_id: str) -> Doc | None:
        return next((d for d in self.docs if d.id == doc_id), None)


def _cos(a, b) -> float:
    if not a or not b:
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    return dot / (math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b)) or 1)


def _snippet(body: str, qt: list[str], n: int = 220) -> str:
    text = re.sub(r"\s+", " ", body)
    sentences = re.split(r"(?<=[.!?])\s+", text)
    best = max(sentences, key=lambda s: len(set(tokenize(s)) & set(qt)), default=text)
    if best.startswith("Bu belge demo amaçlı") and len(sentences) > 1:
        best = sentences[1]
    return best if len(best) <= n else best[: n - 1].rsplit(" ", 1)[0] + "…"


async def embed(texts: list[str]) -> list[list[float]]:
    log.info("-> yerel Ollama %s/api/embed model=%s (%d metin)", config.OLLAMA_URL, EMBED_MODEL, len(texts))
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(f"{config.OLLAMA_URL}/api/embed",
                              json={"model": EMBED_MODEL, "input": texts, "keep_alive": config.OLLAMA_KEEP_ALIVE})
        r.raise_for_status()
        return r.json()["embeddings"]


INDEX = Index()

ANSWER_SYSTEM = (
    "Sen bu bilgisayarda çalışan yerel bir arama asistanısın. İnternete erişimin yok. "
    "Yalnızca kullanıcının verdiği numaralı YEREL KAYNAKLAR'a dayanarak Türkçe cevap ver. "
    "Kendi genel bilgini kullanma, kaynakta olmayan hiçbir bilgiyi ekleme. "
    "Cevap 2-4 kısa cümle olsun; kullandığın kaynağı cümle sonunda [1], [2] gibi belirt. "
    f"Kaynaklar soruyu cevaplamıyorsa yalnızca şunu yaz: {NOT_FOUND}"
)


_NOT_FOUND_RE = re.compile(r"bulamad|verilerinde bulunm|kaynaklarda (yer almıyor|bulunm|bilgi yok)|kaynaklar(da)? .*cevaplam")


def looks_not_found(text: str) -> bool:
    return bool(_NOT_FOUND_RE.search(norm_tr(text)))


def build_messages(query: str, docs: list[Doc]) -> list[dict]:
    ctx = "\n\n".join(f"[{i}] {d.title} ({d.path})\n{d.body}" for i, d in enumerate(docs, 1))
    return [
        {"role": "system", "content": ANSWER_SYSTEM},
        {"role": "user", "content": f"YEREL KAYNAKLAR:\n{ctx}\n\nSORU: {query}"},
    ]


# Yerel belgelerle güçlü eşleşme eşiği (Jarvis ile aynı ölçüt)
def is_strong(hit: dict) -> bool:
    return hit["score"] >= 0.9 and hit["semantic"] >= 0.62


GENERAL_SYSTEM = (
    "Sen bu bilgisayarda internetsiz çalışan yerel bir yapay zekâ arama asistanısın. "
    "Soruyu kendi eğitim bilginle, Türkçe, açık ve doğru biçimde cevapla: 3-5 cümle, düz metin, markdown kullanma. "
    "Önce sorunun doğrudan cevabını ver, sonra kısa bir bağlam ekle. Emin olmadığın ayrıntıyı uydurma; emin değilsen bunu söyle. "
    "İnternete erişimin yok: güncel haber, hava durumu, döviz, fiyat, skor gibi canlı bilgi gerektiren sorularda "
    "bunu bilemeyeceğini dürüstçe söyle."
)


def general_messages(query: str) -> list[dict]:
    return [{"role": "system", "content": GENERAL_SYSTEM}, {"role": "user", "content": query}]
