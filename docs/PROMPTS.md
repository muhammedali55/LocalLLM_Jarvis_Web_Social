# Bu proje hangi promptlarla yapıldı? / Which prompts built this project?

Bu projenin tamamı, bir yapay zekâ kodlama asistanıyla (Claude Code) **sohbet ederek** yazıldı. Aşağıda sırasıyla kullanılan promptlar var. Kendi sürümünüzü yapmak için aynı sırayı izleyebilir, metinleri kendi ihtiyacınıza göre değiştirebilirsiniz.

The whole project was written by **chatting** with an AI coding assistant (Claude Code). Below are the prompts in the order they were used (originals are Turkish; English translations follow each one). To build your own version, follow the same order and adapt the wording.

> Promptlar kullanıcının yazdığı gibidir; yalnızca birkaç yazım hatası düzeltildi ve kişisel bilgiler çıkarıldı.
> Prompts are as typed by the user; only a few typos were fixed and personal details removed.

---

## 0. Ana proje promptu / Master prompt

Tam metin / full text: [`docs/prompts/00-ana-proje-promptu.md`](prompts/00-ana-proje-promptu.md)

Özetle şunları istiyor / In short it asks for:
- Wi‑Fi kapalıyken aynı MacBook'ta çalışan 3 demo: Google benzeri yerel arama, bot sosyal sitesi, Jarvis benzeri sesli asistan.
  *3 demos that run on one MacBook with Wi‑Fi off: a Google‑like local search, a bot social site, a Jarvis‑like voice assistant.*
- React + Vite + TypeScript arayüz, Python + FastAPI backend, yerel model çalıştırıcı (LM Studio/Ollama), whisper.cpp, yerel TTS.
- Hiçbir CDN, dış font, analytics, bulut API'si yok; her şey `127.0.0.1`.
- Önce makineyi incele (preflight); model değişikliğini **sormadan yapma**; hiçbir şeyi silme.
- Gerçek olmayan şeyi gerçekmiş gibi gösterme (sahte Google sonucu, gerçek sosyal hesap, internet bağlantısı yok).

> İpucu / Tip: Uzun bir "ana prompt" yazıp sonra kısa adımlarla ilerlemek çok iyi çalıştı. Ana prompta *kuralları* (yerel kal, sorma-gerektiren kararlar, gizlilik) koyun; adım promptlarında sadece *ne istediğinizi* söyleyin.
> Writing one long master prompt with the *rules*, then moving in short step prompts that only say *what you want next*, worked very well.

---

## 1. Ortamı incele, Jarvis'ten başla / Inspect the machine, start with Jarvis

> şimdi şöyle bir konumuz var. bunları bu proje içinde gerçekleyeceğiz. bu nedenle benim söylediğim şeyleri sırayla yapmalısın. ilk olarak jarvis benzerini yapacağız. bunun için ne kurmalıyız neler hazır hızlıca bakalım sonra diğerleri ile devam ederiz.

*EN: "We'll build these inside this project, in the order I say. First the Jarvis‑like assistant. Quickly check what's already installed and what we need, then we'll continue with the others."*

Sonuç / Result: Asistan; Mac'i, Ollama'yı, kurulu modelleri, whisper.cpp'yi, ffmpeg'i ve Türkçe macOS seslerini kontrol etti. Qwen4 bulunamadığını bildirip **karar sordu**.

## 2. Model kararı / Model decision

> Evet, qwen3.8 ile

*EN: "Yes, go with qwen3.8."* (Qwen4 yoktu; kurulu qwen3.8 seçildi. / Qwen4 wasn't available; the installed qwen3.8 was chosen.)

Sonuç: Whisper modeli indirildi, FastAPI backend + React arayüz + başlat/durdur betikleri yazıldı, ilk Jarvis çalıştı.

## 3. Yerel arama / Local search

> Yerel aramaya geç

*EN: "Move on to local search."*

Sonuç: 15 özgün demo belgesi, anahtar kelime + yerel embedding karma arama, kaynak numaralı Qwen cevabı, kaynak kartları.

## 4. Jarvis'i yeniden tasarla / Redesign Jarvis

> jarvis istediğim gibi olmamış, görselleri yanlış, ses çok kötü. bunları düzeltmeliyiz. jarvis in farklı tepkileri için farklı görseller hazırladım görünüm böyle olmalı. ayrıca ben susunca yanıt vermeli. ben başlatırım okey ama beni dinlemeli sürekli ben bitirene kadar kendini kapatmamalı ya da ben kapat dediğimde kapatmalı. karşılıklı iletişimde kalmalıyız. ben bişeylere tıklamamalıyım. ne söylediğimi bir yerlere yazmamalı, sonuçları bir yerlere yazmamalı direkt konuşmalı.

*EN: "Jarvis isn't what I wanted: visuals are wrong and the voice is bad. I prepared a design with different visuals for each state (attached image). It should answer when I stop talking; I start it once, then it keeps listening until I say 'close'. A real back‑and‑forth. No clicking, no transcript or answer text on screen — just talk."*

Ek / Attachment: Her durum için bir görsel tasarım (Hazır, Dinleme, Düşünme, Arama, Cevaplıyor, Tamamlandı…). *A mockup image with one visual per state.*

Sonuç: Sessizlik algılamalı sürekli dinleme, cümle cümle akışlı yanıt, durum başına renk/simge değiştiren reaktör görseli, "Jarvis, kapat" komutu. Ses motoru için bir alt‑ajan 5 yerel Türkçe TTS'i karşılaştırdı.

## 5. Ses motorunu seç / Pick the voice engine

> Evet, yazgı bağla

*EN: "Yes, connect yazgı."* (Karşılaştırmada en anlaşılır ve hızlı Türkçe ses yazgı‑tts‑1 çıktı. / yazgı‑tts‑1 was the clearest and fast enough.)

## 6. Tarayıcısız Jarvis / Browser‑less Jarvis

> peki şöyle bir şey yapabilir miyiz? hiç bir web sekmesi açık değil ama arka planda bir servis çalışıyor ve jarvis açılıyor bunu yapabilir miyiz?

*EN: "Can we have no browser tab open at all, but a background service running, and Jarvis just opens?"*

Asistanın sorularına verilen cevaplar / Answers to the assistant's follow‑up questions:
- Uyandırma: **"Jarvis" deyince** / Wake: **by saying "Jarvis"**
- Görünüm: **reaktör penceresi açılsın** / Show: **a reactor window**
- Otomatik başlatma: **hayır, komutla** / Autostart: **no, start by command**

## 7. Arka plan sesi bozuk / Background audio is distorted

> ses çok kötü. sanki hoparlör patlamış gibi geliyor. web browserda temiz ve kaliteli gelen ses arka planda çalışan versiyonunda çok kötü

*EN: "The sound is terrible, like a blown speaker. It's clean in the browser but awful in the background version."*

Sonuç: Ses geri çağrısının içindeki yavaş pencere çağrısı kesintilere yol açıyordu; tek ve sürekli 48 kHz çıkış akışına geçildi, kesinti sayacı eklendi.
*Result: a slow UI call inside the audio callback caused underruns; fixed with a single continuous 48 kHz output stream.*

## 8. Bot sosyal sitesi / Bot social site

> şimdi ses temiz, bot sosyal sitesine geçelim

*EN: "Sound is clean now, let's do the bot social site."*

Sonuç: 4 kurgusal bot, "Kare akış" ve "Pano" görünümleri, sıralı Qwen istekleri, yerel çizilen SVG "fotoğraflar", SQLite kalıcılık.

## 9. Arama genel soruları da cevaplasın / Search should answer general questions

> burada bir eksik var, yerelde arama kısmında eksiklikler var, şöyle ki arama kısmında sorularıma qwen kod cevap versin, mesela albert einstein kimdir dediğimde bulsun arkadaşım.

*EN: "Local search is missing something: Qwen should answer my questions directly — e.g. 'Who is Albert Einstein?' should work."*

Sonuç: Yerel belgelerle eşleşen sorular kaynaklı, diğerleri "modelin kendi bilgisi · internet yok" etiketiyle cevaplanıyor.

## 10. Herkese açık paylaşım / Publish

> bu ürettiğimiz yapıyı ve kodu benim github repoma public olarak paylaşmamız gerekiyor. ... benimle ilgili hiç bir özel şey, şifre v.s. olmamalı ... readme.md türkçe ve ing. ... nasıl kurulur, nasıl kullanılır, hangi promptları kullandım ... kendileri yazmak ve özelleştirmek isterseler nasıl yapacakları

*EN: "Publish this to my public GitHub repo, with nothing private in it, a Turkish + English README covering install, usage, the prompts I used, and how others can build or customize it themselves."* → bu belge / this document.

---

## Kendi sürümünüzü promptlarla yapmak / Building your own version with prompts

1. **Ana promptu kopyalayın ve uyarlayın.** Makinenizi, modelinizi ve dilinizi yazın. Kuralları koruyun: *yerel kal, kişisel veri kullanma, büyük kararları sor, hiçbir şeyi silme*.
   *Copy and adapt the master prompt (your machine, model, language). Keep the rules: stay local, no personal data, ask before big decisions, never delete.*
2. **Önce preflight isteyin:** "Ne kurulu, ne eksik, bakalım." Asistanın model/kurulum kararını size sormasını sağlayın.
   *Ask for a preflight first and let the assistant ask you about model/installs.*
3. **Her seferinde tek dikey dilim:** "Önce Jarvis", "şimdi arama"… Her adım çalışır hâlde kalsın.
   *One vertical slice at a time; keep every step working.*
4. **Görsel istiyorsanız görsel verin.** Bir taslak/mockup resmi, uzun bir tarif yazısından çok daha iyi sonuç verdi.
   *If you care about looks, attach a mockup image — it beat long descriptions.*
5. **Hissettiğinizi söyleyin.** "Ses hoparlör patlamış gibi" gibi gözlemler, asistanın asıl hatayı bulmasına yetti.
   *Describe what you observe ("sounds like a blown speaker"); that was enough to find the real bug.*
6. **Ölçüm isteyin.** Gecikme, Whisper geri‑okuma testi, ağ istekleri listesi gibi ölçümler "çalışıyor" iddiasını doğrular.
   *Ask for measurements (latency, round‑trip ASR, network requests) to verify claims.*

Örnek başlangıç promptu / Example starter prompt:

```text
Bu klasörde, internet kapalıyken çalışan yerel bir AI asistanı yapacağız.
Kurallar: her şey 127.0.0.1'de çalışsın, bulut API'si/CDN kullanma, kişisel veri ekleme,
model veya büyük kurulum kararlarını önce bana sor, mevcut dosyaları silme.
Önce makinemi incele (OS, RAM, Ollama/LM Studio, kurulu modeller, whisper.cpp, ffmpeg) ve
ne eksik olduğunu kısaca listele. Sonra [demo adı] ile başlayalım.
```
