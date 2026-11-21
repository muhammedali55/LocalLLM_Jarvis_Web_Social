"""Demo 2: botların çalıştığı YEREL sosyal ağ simülasyonu.

Gerçek hiçbir platforma bağlanmaz. Botlar, gönderiler ve yorumlar data/social/social.db
(SQLite) dosyasında tutulur. İçerik yerel Qwen ile, istekler sırayla gönderilerek üretilir.
"""
import asyncio
import json
import logging
import re
import sqlite3
import time
from contextlib import closing

from . import config, llm

log = logging.getLogger("yerel.social")

DIR = config.ROOT / "data" / "social"
DB = DIR / "social.db"
SCENARIO = json.loads((DIR / "scenario.json").read_text(encoding="utf-8"))
BOTS = {b["id"]: b for b in SCENARIO["bots"]}
BOT_ORDER = [b["id"] for b in SCENARIO["bots"]]
GROUPS = {g["id"]: g for g in SCENARIO["groups"]}
MOTIFS = ["deniz", "dag", "sehir", "kod", "kahve", "gece", "orman"]
MOODS = ["sabah", "gunbatimi", "gece", "pastel"]

RUN_LOCK = asyncio.Lock()


def _conn() -> sqlite3.Connection:
    DIR.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    c.executescript(
        """
        CREATE TABLE IF NOT EXISTS posts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          bot TEXT NOT NULL, kind TEXT NOT NULL, grp TEXT, text TEXT NOT NULL,
          scene TEXT, likes TEXT NOT NULL DEFAULT '[]',
          source TEXT NOT NULL, seconds REAL, created REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS comments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          post INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
          bot TEXT NOT NULL, text TEXT NOT NULL, source TEXT NOT NULL,
          seconds REAL, created REAL NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post);
        CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
        """
    )
    return c


def _meta(c, k, default=None):
    r = c.execute("SELECT v FROM meta WHERE k=?", (k,)).fetchone()
    return json.loads(r["v"]) if r else default


def _set_meta(c, k, v):
    c.execute("INSERT INTO meta(k, v) VALUES(?, ?) ON CONFLICT(k) DO UPDATE SET v=excluded.v", (k, json.dumps(v)))


def ensure_seeded():
    with closing(_conn()) as c:
        if not _meta(c, "initialized"):
            _load_seed(c)
            c.commit()


def _load_seed(c):
    c.execute("DELETE FROM comments")
    c.execute("DELETE FROM posts")
    now = time.time() - 3600 * 5
    for i, p in enumerate(SCENARIO["seed"]):
        t = now + i * 1800
        cur = c.execute(
            "INSERT INTO posts(bot, kind, grp, text, scene, likes, source, created) VALUES(?,?,?,?,?,?,?,?)",
            (p["bot"], p["kind"], p.get("group"), p["text"], json.dumps(p.get("scene")), json.dumps(p.get("likes", [])),
             "seed", t),
        )
        for j, cm in enumerate(p.get("comments", [])):
            c.execute("INSERT INTO comments(post, bot, text, source, created) VALUES(?,?,?,?,?)",
                      (cur.lastrowid, cm["bot"], cm["text"], "seed", t + 60 * (j + 1)))
    _set_meta(c, "round", 0)
    _set_meta(c, "initialized", True)


def reset(mode: str):
    with closing(_conn()) as c:
        if mode == "empty":
            c.execute("DELETE FROM comments")
            c.execute("DELETE FROM posts")
            _set_meta(c, "round", 0)
            _set_meta(c, "initialized", True)
        else:
            _load_seed(c)
        c.commit()


def _post_dict(r, comments) -> dict:
    return {
        "id": r["id"], "bot": r["bot"], "kind": r["kind"], "group": r["grp"], "text": r["text"],
        "scene": json.loads(r["scene"]) if r["scene"] else None, "likes": json.loads(r["likes"]),
        "source": r["source"], "seconds": r["seconds"], "created": r["created"],
        "comments": [
            {"id": x["id"], "bot": x["bot"], "text": x["text"], "source": x["source"],
             "seconds": x["seconds"], "created": x["created"]}
            for x in comments
        ],
    }


def feed() -> dict:
    ensure_seeded()
    with closing(_conn()) as c:
        posts = c.execute("SELECT * FROM posts ORDER BY created DESC, id DESC").fetchall()
        cmts: dict[int, list] = {}
        for x in c.execute("SELECT * FROM comments ORDER BY created, id"):
            cmts.setdefault(x["post"], []).append(x)
        return {
            "bots": [{k: b[k] for k in ("id", "name", "handle", "color", "bio", "group")} for b in SCENARIO["bots"]],
            "groups": SCENARIO["groups"],
            "posts": [_post_dict(p, cmts.get(p["id"], [])) for p in posts],
            "round": _meta(c, "round", 0),
            "db": str(DB.relative_to(config.ROOT)),
        }


# ---------------- Üretim ----------------

def _system(bot: dict) -> str:
    return (
        f"Sen '{bot['name']}' (@{bot['handle']}) adlı KURGUSAL bir sosyal medya botusun. "
        "Bu, bir bilgisayarda tamamen yerel çalışan bir simülasyondur; gerçek bir kişi değilsin ve gerçek bir platformda paylaşım yapmıyorsun. "
        f"Kişiliğin: {bot['persona']} Yazım tarzın: {bot['style']} "
        "Her zaman Türkçe yaz. Gerçek kişi adı, marka, siyaset veya güncel haber kullanma; uydurma istatistik verme. "
        "Emoji kullanma."
    )


def _clean(t: str, limit: int) -> str:
    t = re.sub(r"\s+", " ", t).strip().strip('"“”«»\'').strip()
    t = re.sub(r"^(yorum|gönderi|cevap)\s*:\s*", "", t, flags=re.I)
    if len(t) > limit:
        cut = t[:limit]
        t = cut[: max(cut.rfind("."), cut.rfind("!"), cut.rfind("?")) + 1] or cut.rsplit(" ", 1)[0] + "…"
    return t


async def _gen_post(bot: dict, kind: str, topic: str, seed: int) -> tuple[dict, float]:
    grp = GROUPS[bot["group"]]
    if kind == "photo":
        task = (f"Konu: {topic}. '{grp['name']}' topluluğu için bir FOTOĞRAF paylaşımı hazırla. "
                "Fotoğraf açıklaması 1-2 kısa cümle olsun (en fazla 200 karakter). "
                f"Fotoğrafın sahnesini şu seçeneklerden seç: motif={MOTIFS}, mood={MOODS}.")
        schema = {"type": "object", "properties": {
            "text": {"type": "string"}, "motif": {"type": "string", "enum": MOTIFS},
            "mood": {"type": "string", "enum": MOODS}}, "required": ["text", "motif", "mood"]}
    else:
        task = (f"Konu: {topic}. '{grp['name']}' topluluğuna bir METİN gönderisi yaz. "
                "2-3 cümle olsun (en fazla 300 karakter).")
        schema = {"type": "object", "properties": {"text": {"type": "string"}}, "required": ["text"]}
    res = await llm.chat(
        [{"role": "system", "content": _system(bot)}, {"role": "user", "content": task + " Yanıtı JSON olarak ver."}],
        temperature=0.85, max_tokens=260, fmt=schema, seed=seed,
    )
    try:
        data = json.loads(res["text"])
    except json.JSONDecodeError:
        data = {"text": res["text"]}
    out = {"text": _clean(str(data.get("text", "")), 320 if kind == "text" else 220)}
    if kind == "photo":
        out["scene"] = {"motif": data.get("motif") if data.get("motif") in MOTIFS else "deniz",
                        "mood": data.get("mood") if data.get("mood") in MOODS else "sabah"}
    return out, res["seconds"]


async def _gen_comment(bot: dict, author: dict, text: str, seed: int) -> tuple[str, float]:
    task = (f"@{author['handle']} ({author['name']}) şunu paylaştı:\n«{text}»\n\n"
            "Bu gönderiye kendi kişiliğin ve tarzınla tek cümlelik, en fazla 140 karakterlik doğal bir yorum yaz. "
            "Yalnızca yorum metnini yaz.")
    res = await llm.chat([{"role": "system", "content": _system(bot)}, {"role": "user", "content": task}],
                         temperature=0.85, max_tokens=90, seed=seed)
    return _clean(res["text"], 160), res["seconds"]


def plan(rnd: int) -> dict:
    """Sabit, tekrar üretilebilir senaryo: tur numarasından kim ne yapacak belirlenir."""
    n = len(BOT_ORDER)
    author = BOTS[BOT_ORDER[rnd % n]]
    kind = author["kinds"][(rnd // n) % len(author["kinds"])]
    topic = author["topics"][(rnd // n) % len(author["topics"])]
    commenters = [BOTS[BOT_ORDER[(rnd + k) % n]] for k in (1, 2)]
    return {"author": author, "kind": kind, "topic": topic, "commenters": commenters}


def _ev(**kw) -> str:
    return json.dumps(kw, ensure_ascii=False) + "\n"


async def run_round():
    """Turu arka plan görevinde çalıştırır; sayfa kapansa/yenilense bile tur tamamlanır."""
    if RUN_LOCK.locked():
        yield _ev(type="error", message="Botlar zaten çalışıyor.")
        return
    q: asyncio.Queue = asyncio.Queue()

    async def worker():
        try:
            async for ev in _round_events():
                q.put_nowait(ev)
        finally:
            q.put_nowait(None)

    task = asyncio.create_task(worker())
    _TASKS.add(task)
    task.add_done_callback(_TASKS.discard)
    while (ev := await q.get()) is not None:
        yield ev


_TASKS: set = set()


async def _round_events():
    """NDJSON olayları: queue → (step_start → post|comment → step_done)* → done."""
    async with RUN_LOCK:
        ensure_seeded()
        with closing(_conn()) as c:
            rnd = _meta(c, "round", 0)
        p = plan(rnd)
        a = p["author"]
        steps = [{"bot": a["id"], "action": "photo" if p["kind"] == "photo" else "text", "label": f"{a['name']} gönderi hazırlıyor"}]
        steps += [{"bot": b["id"], "action": "comment", "label": f"{b['name']} yorum yazıyor"} for b in p["commenters"]]
        yield _ev(type="queue", round=rnd, steps=steps)
        t_all = time.perf_counter()
        try:
            # 1) Gönderi
            yield _ev(type="step_start", i=0)
            post, sec = await _gen_post(a, p["kind"], p["topic"], seed=1000 + rnd)
            with closing(_conn()) as c:
                cur = c.execute(
                    "INSERT INTO posts(bot, kind, grp, text, scene, likes, source, seconds, created) VALUES(?,?,?,?,?,?,?,?,?)",
                    (a["id"], p["kind"], a["group"], post["text"], json.dumps(post.get("scene")), "[]", "qwen", sec, time.time()),
                )
                pid = cur.lastrowid
                c.commit()
            log.info("bot gönderisi: %s, %.2f sn", a["id"], sec)
            yield _ev(type="post", post=_one(pid))
            yield _ev(type="step_done", i=0, seconds=sec)

            # 2) Yorumlar (sırayla, paralel değil)
            for i, b in enumerate(p["commenters"], start=1):
                yield _ev(type="step_start", i=i)
                text, sec = await _gen_comment(b, a, post["text"], seed=2000 + rnd * 10 + i)
                with closing(_conn()) as c:
                    c.execute("INSERT INTO comments(post, bot, text, source, seconds, created) VALUES(?,?,?,?,?,?)",
                              (pid, b["id"], text, "qwen", sec, time.time()))
                    likes = json.loads(c.execute("SELECT likes FROM posts WHERE id=?", (pid,)).fetchone()["likes"])
                    if b["id"] not in likes:
                        likes.append(b["id"])  # yorum yapan bot beğenir de
                    c.execute("UPDATE posts SET likes=? WHERE id=?", (json.dumps(likes), pid))
                    c.commit()
                log.info("bot yorumu: %s, %.2f sn", b["id"], sec)
                yield _ev(type="post", post=_one(pid))
                yield _ev(type="step_done", i=i, seconds=sec)

            with closing(_conn()) as c:
                _set_meta(c, "round", rnd + 1)
                c.commit()
            yield _ev(type="done", seconds=round(time.perf_counter() - t_all, 2), post_id=pid)
        except llm.LLMError as e:
            yield _ev(type="error", message=str(e))


def _one(pid: int) -> dict:
    with closing(_conn()) as c:
        r = c.execute("SELECT * FROM posts WHERE id=?", (pid,)).fetchone()
        cm = c.execute("SELECT * FROM comments WHERE post=? ORDER BY created, id", (pid,)).fetchall()
        return _post_dict(r, cm)
