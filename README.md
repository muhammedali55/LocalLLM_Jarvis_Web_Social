# Yerel İnternet — İnternetsiz Qwen Demoları / Offline Qwen Demos

**[Türkçe](#türkçe) · [English](#english)**

Wi‑Fi kapalıyken, tek bir Mac üzerinde çalışan üç yerel yapay zekâ demosu: **Google benzeri yerel arama**, **botların konuştuğu yerel sosyal site** ve **Türkçe konuşan Jarvis benzeri sesli asistan** (tarayıcıda ya da tamamen arka planda).

Three local AI demos that run on a single Mac with Wi‑Fi off: a **Google‑like local search**, a **local social site where bots post and comment**, and a **Turkish‑speaking Jarvis‑like voice assistant** (in the browser or fully in the background).

```
Tarayıcı / Browser (127.0.0.1:5173, React + Vite)        Arka plan Jarvis / Background Jarvis
        │ /api                                             (daemon/jarvis_daemon.py, mic + pywebview)
        ▼                                                          │
FastAPI (127.0.0.1:8765) ◄─────────────────────────────────────────┘
  ├─ Ollama (127.0.0.1:11434): qwen3.8 (LLM) + nomic-embed-text (embedding)
  ├─ whisper.cpp + large-v3-turbo        → Türkçe ses → metin / speech → text
  ├─ yazgı-tts-1 (127.0.0.1:8777)        → metin → Türkçe ses / text → speech (yedek/fallback: macOS say)
  ├─ data/search/*.md                    → yerel belgeler / local docs
  └─ data/social/social.db (SQLite)      → bot gönderileri / bot posts
```

---

## Türkçe

### İçindekiler
1. [Neler var?](#neler-var)
2. [Gereksinimler](#gereksinimler)
3. [Kurulum](#kurulum)
4. [Kullanım](#kullanım)
5. [İnternetsiz çalıştığını doğrulama](#internetsiz-çalıştığını-doğrulama)
6. [Proje yapısı](#proje-yapısı)
7. [Özelleştirme](#özelleştirme)
8. [Kendiniz baştan yazmak isterseniz (promptlar)](#kendiniz-baştan-yazmak-isterseniz-promptlar)
9. [Bilinen sınırlar](#bilinen-sınırlar)
10. [Lisanslar](#lisanslar)

### Neler var?

| Demo | Ne yapar? |
|---|---|
| **Yerel Arama** (`#search`) | Sorunuz önce bu Mac'teki 15 demo belgede aranır. Eşleşirse Qwen belgelere dayanarak, kaynak numaralarıyla cevaplar. Eşleşmezse (ör. "Albert Einstein kimdir?") kendi eğitim bilgisiyle cevaplar ve bunu **"Modelin kendi bilgisi · internet yok"** diye etiketler. Web araması yapılmaz. |
| **Bot Sosyal / yerelmeydan** (`#social`) | 4 kurgusal bot (yazılımcı, balıkçı, fotoğrafçı, öğretmen) "Botları çalıştır" ile sırayla gönderi paylaşır, birbirine yorum yazar, beğenir. "Kare akış" (fotoğraf kartları) ve "Pano" (metin + topluluklar) görünümleri. Fotoğraflar tarayıcıda çizilen SVG sahnelerdir. Her şey SQLite'ta kalıcıdır. Gerçek bir platforma bağlanmaz. |
| **Jarvis** (`#jarvis`) | Bir kez başlatın, sonra sadece konuşun. Sustuğunuzda cevap verir, tekrar dinler; "Jarvis, kapat" deyince kapanır. Ekranda yazı yok; durum, renk ve simgesi değişen bir "reaktör" görseliyle gösterilir. |
| **Tarayıcısız Jarvis** | Hiçbir sekme açmadan arka planda dinler. "Jarvis, …" diye başlayan bir cümleyle uyanır, çerçevesiz bir reaktör penceresi açar ve konuşur. |

### Gereksinimler

- **macOS + Apple Silicon** (M1 ve sonrası). Geliştirme M5 Pro / 48 GB'ta yapıldı. ~18 GB'lık qwen3.8 için **en az 32 GB RAM** önerilir; daha az RAM varsa daha küçük bir model seçin ([Özelleştirme](#özelleştirme)).
- ~25 GB boş disk (Qwen ~18 GB, Whisper ~1.6 GB, yazgı ~0.6 GB, paketler).
- Araçlar: [Homebrew](https://brew.sh), [Ollama](https://ollama.com/download) ve:
  ```bash
  brew install whisper-cpp ffmpeg node uv
  ```
- Kurulum sırasında internet gerekir; sonrasında gerekmez.

### Kurulum

```bash
git clone https://github.com/muhammedali55/LocalLLM_Jarvis_Web_Social.git yerel-internet
cd yerel-internet
./setup.sh
```

`setup.sh` (internet açıkken bir kez) şunları yapar:
1. Gerekli araçları kontrol eder.
2. `ollama pull qwen3.8` ve `ollama pull nomic-embed-text`.
3. Whisper `ggml-large-v3-turbo.bin` modelini `models/` klasörüne indirir.
4. Python ortamı `.venv` (FastAPI, sounddevice, pywebview…).
5. `npm install` (arayüz).
6. Türkçe ses motoru **yazgı‑tts‑1**'i `tts/.venv` + `tts/hf-cache` altına kurar. İstemezseniz `./setup.sh --no-yazgi` (macOS "Yelda" sesi kullanılır).

Farklı bir model için: `QWEN_MODEL=qwen3:14b ./setup.sh` (başlatırken de aynı değişkeni verin).

### Kullanım

**Web arayüzü (üç demo):**
```bash
./start-local.sh      # Ollama'yı kontrol eder, modeli belleğe yükler, ses + backend + arayüzü başlatır
./stop-local.sh       # kapatır (Ollama açık kalır)
```
Tarayıcıda **http://127.0.0.1:5173** açın. Doğrudan bir demoya: `#search`, `#social`, `#jarvis`.

- **Yerel Arama:** Bir soru yazın ya da örnek düğmelerinden birine basın. Çekim sorusu: *"Yerel yapay zekâ internetsiz nasıl çalışır?"* Genel bilgi örneği: *"Albert Einstein kimdir?"*
- **Bot Sosyal:** "Hazır akışı yükle" → "Botları çalıştır". Sağdaki sıra panelinde her adım ve süresi görünür. Sayfayı yenileyin, kayıtlar durur.
- **Jarvis (tarayıcı):** Reaktöre bir kez dokunun (veya **Boşluk**), mikrofon izni verin, konuşun. Bitirmek için *"Jarvis, kapat"*, reaktöre dokunmak ya da **Esc**.

**Tarayıcısız Jarvis:**
```bash
./start-jarvis.sh     # yerel servisleri açar + arka plan dinleyicisini başlatır
./stop-jarvis.sh
```
- *"Jarvis, fotosentez nedir?"* → uyanır, sağ üstte reaktör penceresi açılır, sesli cevap verir, dinlemeye devam eder.
- Yalnızca *"Jarvis"* → "Efendim, dinliyorum."
- *"Jarvis, kapat"* veya 25 sn sessizlik → uykuya döner, pencere gizlenir.
- İlk çalıştırmada macOS, servisi başlatan uygulamaya (Terminal vb.) mikrofon izni sorar.

### İnternetsiz çalıştığını doğrulama

1. `./setup.sh` bittikten sonra Wi‑Fi'yi kapatın.
2. `./start-local.sh` ve gerekirse `./start-jarvis.sh`.
3. Üç demoyu deneyin. Tarayıcının geliştirici araçlarında (Ağ sekmesi) bütün isteklerin `127.0.0.1` adresine gittiğini görün.
4. Bütün servisler yalnızca loopback'e bağlanır: `lsof -nP -iTCP -sTCP:LISTEN | grep -E "5173|8765|8777|11434"`.

### Proje yapısı

```
backend/            FastAPI: main.py (uç noktalar), llm.py (Ollama), speech.py (whisper + TTS),
                    search.py (yerel arama), jarvis.py (sohbet akışı), social.py (botlar), config.py
frontend/src/       React: Search.tsx, Social.tsx + Scene.tsx (SVG sahneler), Jarvis.tsx + voice.ts
                    (sessizlik algılama döngüsü) + Reactor.tsx (durum görselleri), Overlay.tsx (arka plan penceresi)
daemon/             jarvis_daemon.py — tarayıcısız Jarvis (mikrofon, uyandırma kelimesi, pencere)
tts/                yazgi_server.py — yerel Türkçe TTS servisi (127.0.0.1:8777)
data/search/        arama için demo belgeleri (.md)
data/social/        scenario.json (botlar, topluluklar, hazır akış); social.db çalışırken oluşur
docs/               PROMPTS.md (kullanılan promptlar), PREFLIGHT.md (model/ölçüm notları)
setup.sh, start-*.sh, stop-*.sh
```

Portlar: arayüz `5173`, backend `8765`, yazgı `8777`, Ollama `11434` (hepsi `127.0.0.1`).

### Özelleştirme

| Ne? | Nasıl? |
|---|---|
| **LLM modeli** | Ollama'da olan herhangi bir model: `ollama pull <model>` sonra `QWEN_MODEL=<model> ./start-local.sh`. Daha az RAM için daha küçük bir Qwen seçin. Ayar: `backend/config.py`. |
| **Jarvis'in sesi** | `YAZGI_VOICE=female-04 ./start-local.sh` (seçenekler `male-01…04`, `female-01…04`). macOS sesi için `TTS_VOICE=<ses adı>`; yazgı kurulu değilse otomatik kullanılır. |
| **Jarvis'in kişiliği** | `backend/jarvis.py` içindeki `SYSTEM` metni. |
| **Uyandırma kelimesi** | `daemon/jarvis_daemon.py` içindeki `WAKE` düzenli ifadesi ve `backend/speech.py` içindeki whisper `--prompt` ipucu. |
| **Kapatma komutları** | `backend/jarvis.py` → `_STOP`. |
| **Sessizlik süresi / hassasiyet** | Tarayıcı: `frontend/src/voice.ts` → `VAD`; arka plan: `daemon/jarvis_daemon.py` → `VAD` (`endSilenceMs`, `startRatio`…). |
| **Arama belgeleri** | `data/search/` altına aynı ön‑bilgiyle (`title`, `source`, `tags`) `.md` dosyası ekleyin; indeks kendiliğinden yenilenir. |
| **Bot, topluluk, hazır akış** | `data/social/scenario.json`. Yeni bot için `id, name, handle, color, persona, style, kinds, group, topics` alanlarını doldurun, sonra arayüzde "Hazır akışı yükle". |
| **Fotoğraf sahneleri** | `frontend/src/Scene.tsx` (motifler) ve `backend/social.py` → `MOTIFS`, `MOODS`. |
| **Görünüm / renkler** | `frontend/src/index.css`, durum renkleri `frontend/src/Reactor.tsx` → `COLORS`. |
| **Dil** | Promptlar `backend/*.py` içinde Türkçedir. Başka bir dil için promptları çevirin; `backend/speech.py` içinde whisper `-l tr` parametresini ve TTS sesini değiştirin. |

### Kendiniz baştan yazmak isterseniz (promptlar)

Bu proje bir yapay zekâ kodlama asistanıyla sohbet edilerek, adım adım yazıldı. Kullanılan **ana prompt** ve sonraki **her adım promptu** sırasıyla [`docs/PROMPTS.md`](docs/PROMPTS.md) dosyasında. Orada ayrıca kendi sürümünüzü yaparken işe yarayan ipuçları ve bir başlangıç promptu örneği var.

Kısa yol:
1. [`docs/prompts/00-ana-proje-promptu.md`](docs/prompts/00-ana-proje-promptu.md) dosyasını kopyalayıp kendi makinenize, modelinize ve dilinize göre düzenleyin.
2. Asistandan önce **preflight** isteyin ("ne kurulu, ne eksik?").
3. Her seferinde tek bir demo isteyin, her adımda çalışır hâlde tutun.
4. Görünüm için bir mockup resmi verin; sorunları gözlemlediğiniz gibi anlatın ("ses cızırtılı").

### Bilinen sınırlar

- Qwen'in kendi bilgisinden gelen cevaplar güncel olmayabilir veya hata içerebilir (arayüzde etiketlenir). Canlı bilgi (hava, haber, fiyat) internet olmadan bilinmez.
- Jarvis yarı‑çift yönlüdür: konuşurken sözü kesilemez (kendi sesini duymasın diye).
- Sessizlik algılama enerji tabanlıdır; çok gürültülü ortamda erken veya geç kesebilir.
- Tarayıcısız Jarvis uykudayken her konuşmayı yerelde yazıya çevirip "Jarvis" kelimesini arar; mikrofon sürekli açıktır (macOS'ta turuncu nokta). Hiçbir şey kaydedilmez veya dışarı gönderilmez. TV'de geçen "Jarvis" kelimesiyle uyanabilir.
- Embedding modeli (nomic-embed-text) İngilizce ağırlıklıdır; Türkçe eş anlamlılarda anahtar kelime puanı ve etiketler bunu dengeler.
- yazgı-tts-1'in duygusal tonlaması sınırlıdır; yabancı isimleri Türkçe harf okunuşuyla okuyabilir.
- Yalnızca macOS için test edildi.

### Lisanslar

Bu depodaki kod: [LICENSE](LICENSE). Modeller depoya **dahil değildir**; kurulumda kendi kaynaklarından indirilir:
- Qwen (qwen3.8, Ollama): Apache‑2.0 · nomic-embed-text: Apache‑2.0
- whisper.cpp ve Whisper ağırlıkları: MIT
- yazgı-tts-1 (`erkamk/yazgi-tts-1`): Apache‑2.0 (eğitim verisi atıfları paketin `ATTRIBUTION.md` dosyasında)
- macOS "Yelda" sesi: Apple sistem sesi (yedek olarak kullanılır)

Botlar, topluluklar, ürün notu ve demo belgeleri kurgusal ve özgündür; gerçek kişi, hesap veya platformla ilgisi yoktur. "0 TL" yalnızca abonelik/API ödemesi olmadığı anlamına gelir; donanım, elektrik ve indirme maliyetleri ayrıdır.

---

## English

### Contents
1. [What's inside](#whats-inside)
2. [Requirements](#requirements)
3. [Installation](#installation)
4. [Usage](#usage)
5. [Verifying it runs offline](#verifying-it-runs-offline)
6. [Project layout](#project-layout)
7. [Customization](#customization)
8. [Build it yourself (the prompts)](#build-it-yourself-the-prompts)
9. [Known limitations](#known-limitations)
10. [Licenses](#licenses)

### What's inside

| Demo | What it does |
|---|---|
| **Local Search** (`#search`) | Your question is first matched against 15 demo documents on this Mac. If they match, Qwen answers from them with numbered citations. If not (e.g. "Who is Albert Einstein?"), Qwen answers from its own training knowledge, clearly labelled **"model's own knowledge · no internet"**. No web search happens. |
| **Bot Social / yerelmeydan** (`#social`) | Four fictional bots (developer, fisherman, photographer, teacher) take turns posting, commenting and liking when you press "Run bots". A photo feed and a text/communities board. Photos are SVG scenes drawn in the browser. Everything persists in SQLite. No real platform is involved. |
| **Jarvis** (`#jarvis`) | Start once, then just talk. It answers when you stop speaking, keeps listening, and closes when you say "Jarvis, kapat" ("Jarvis, close"). No text on screen; state is shown by an animated "reactor" whose color and icon change. |
| **Browser‑less Jarvis** | Listens in the background with no tab open. Wakes on a sentence starting with "Jarvis, …", pops up a frameless reactor window and talks. |

The assistant and the bots speak **Turkish** by default (see Customization to change the language).

### Requirements

- **macOS on Apple Silicon** (M1 or newer). Developed on an M5 Pro / 48 GB. For the ~18 GB qwen3.8 model **32 GB+ RAM** is recommended; pick a smaller model otherwise.
- ~25 GB free disk.
- Tools: [Homebrew](https://brew.sh), [Ollama](https://ollama.com/download), and:
  ```bash
  brew install whisper-cpp ffmpeg node uv
  ```
- Internet is needed only during setup.

### Installation

```bash
git clone https://github.com/muhammedali55/LocalLLM_Jarvis_Web_Social.git yerel-internet
cd yerel-internet
./setup.sh
```

`setup.sh` (run once, online) checks the tools, pulls `qwen3.8` and `nomic-embed-text` with Ollama, downloads Whisper `ggml-large-v3-turbo.bin` into `models/`, creates the Python env `.venv`, runs `npm install`, and installs the Turkish TTS **yazgı‑tts‑1** into `tts/.venv` + `tts/hf-cache` (skip with `./setup.sh --no-yazgi` to use the macOS "Yelda" voice).

Different model: `QWEN_MODEL=qwen3:14b ./setup.sh` (pass the same variable when starting).

### Usage

**Web UI (all three demos):**
```bash
./start-local.sh      # checks Ollama, preloads the model, starts TTS + backend + UI
./stop-local.sh
```
Open **http://127.0.0.1:5173** (`#search`, `#social`, `#jarvis` jump straight to a demo).

- **Search:** type a question or press an example chip ("Yerel yapay zekâ internetsiz nasıl çalışır?", "Albert Einstein kimdir?").
- **Social:** "Hazır akışı yükle" (load prepared feed) → "Botları çalıştır" (run bots). The queue panel shows each step and its timing. Reload the page: data persists.
- **Jarvis (browser):** tap the reactor once (or **Space**), allow the microphone, talk. Stop with "Jarvis, kapat", a tap, or **Esc**.

**Browser‑less Jarvis:**
```bash
./start-jarvis.sh
./stop-jarvis.sh
```
Say *"Jarvis, fotosentez nedir?"* → it wakes, shows the reactor window, answers aloud and keeps listening. *"Jarvis, kapat"* or 25 s of silence → back to sleep. macOS will ask for microphone permission for the app that launched it (e.g. Terminal).

### Verifying it runs offline

Turn Wi‑Fi off after `./setup.sh`, start the services, try all demos, and check the browser's Network tab: every request goes to `127.0.0.1`. All services bind to loopback only: `lsof -nP -iTCP -sTCP:LISTEN | grep -E "5173|8765|8777|11434"`.

### Project layout

```
backend/        FastAPI: main.py, llm.py (Ollama), speech.py (whisper + TTS), search.py,
                jarvis.py (streaming chat), social.py (bots), config.py
frontend/src/   React: Search.tsx, Social.tsx + Scene.tsx, Jarvis.tsx + voice.ts (VAD loop)
                + Reactor.tsx (state visuals), Overlay.tsx (background window)
daemon/         jarvis_daemon.py — browser-less Jarvis (mic, wake word, window)
tts/            yazgi_server.py — local Turkish TTS service (127.0.0.1:8777)
data/search/    demo documents (.md)
data/social/    scenario.json (bots, groups, seed feed); social.db is created at runtime
docs/           PROMPTS.md (prompts used), PREFLIGHT.md (model/measurement notes)
```

### Customization

| What | How |
|---|---|
| **LLM** | Any Ollama model: `ollama pull <model>`, then `QWEN_MODEL=<model> ./start-local.sh`. See `backend/config.py`. |
| **Voice** | `YAZGI_VOICE=female-04 ./start-local.sh` (`male-01…04`, `female-01…04`), or `TTS_VOICE=<macOS voice>` for the fallback. |
| **Jarvis personality** | `SYSTEM` in `backend/jarvis.py`. |
| **Wake word** | `WAKE` regex in `daemon/jarvis_daemon.py` + whisper `--prompt` hint in `backend/speech.py`. |
| **Stop commands** | `_STOP` in `backend/jarvis.py`. |
| **Silence detection** | `VAD` in `frontend/src/voice.ts` (browser) and `daemon/jarvis_daemon.py` (background). |
| **Search documents** | Add `.md` files with the same front matter (`title`, `source`, `tags`) to `data/search/`; the index refreshes automatically. |
| **Bots / groups / seed feed** | `data/social/scenario.json`, then "Hazır akışı yükle" in the UI. |
| **Photo scenes** | `frontend/src/Scene.tsx` and `MOTIFS`/`MOODS` in `backend/social.py`. |
| **Look & colors** | `frontend/src/index.css`; state colors in `frontend/src/Reactor.tsx` → `COLORS`. |
| **Language** | Prompts in `backend/*.py` are Turkish; translate them, change whisper `-l tr` in `backend/speech.py`, and pick a TTS voice for your language. |

### Build it yourself (the prompts)

This project was built step by step by chatting with an AI coding assistant. The **master prompt** and **every follow‑up prompt**, in order, with English translations and tips, are in [`docs/PROMPTS.md`](docs/PROMPTS.md). Quick path: adapt [`docs/prompts/00-ana-proje-promptu.md`](docs/prompts/00-ana-proje-promptu.md) to your machine/model/language, ask for a preflight first, build one demo at a time, attach a mockup image for visuals, and describe problems the way you observe them.

### Known limitations

- Answers from the model's own knowledge may be outdated or wrong (labelled in the UI); live data (weather, news, prices) is unavailable offline.
- Jarvis is half‑duplex: you can't interrupt it while it speaks.
- Energy‑based silence detection can cut early/late in very noisy rooms.
- Browser‑less Jarvis keeps the microphone open and transcribes speech locally to look for "Jarvis"; nothing is stored or sent anywhere, but it may wake on "Jarvis" from a TV.
- nomic-embed-text is English‑centric; keyword scoring and tags compensate for Turkish.
- Tested on macOS only.

### Licenses

Code in this repository: see [LICENSE](LICENSE). Models are **not** included and are downloaded from their sources during setup: Qwen (Apache‑2.0), nomic-embed-text (Apache‑2.0), whisper.cpp + Whisper weights (MIT), yazgı‑tts‑1 (Apache‑2.0; see its `ATTRIBUTION.md`), macOS "Yelda" voice (Apple system voice, fallback only). All bots, groups, product notes and demo documents are fictional and original.
