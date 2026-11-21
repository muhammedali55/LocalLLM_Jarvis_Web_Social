# Preflight notu (2026-11-20)

> Geliştirme makinesindeki kontrol ve ölçüm notları. / Notes and measurements from the development machine.

## Makine
- MacBook Pro, Apple M5 Pro, 48 GB RAM, macOS 26.6.2 (25G83)
- Disk: 926 GB, ~460 GB boş

## Model kararı
- **Hedef Qwen4:** Bulunamadı. Ollama kütüphanesinde `qwen4` sayfası 404 döndü, makinede de Qwen4 yok.
- **Kullanılan model (kullanıcı onayıyla, 2026-11-20):** `qwen3.8` (Ollama)
  - Mimari: qwen3_5, 27.8B parametre
  - Quantization: nvfp4, Ollama MLX runner, %100 GPU
  - Boyut: ~18 GB disk, bellekte ~18 GB
  - Bağlam: 262 144 token destekli (yüklü bağlam 65 536)
  - Lisans: Apache License 2.0
  - Düşünme modu: kapalı (`think: false`), Jarvis için hızlı yanıt
- Çalıştırıcı: Ollama 0.40.16, `127.0.0.1:11434` (yalnızca loopback)
- Ölçülen: Türkçe 2-4 cümlelik yanıt ~4-6 sn, ~24-30 token/sn

## Ses
- ASR: whisper.cpp 1.8.6 (Homebrew, Metal GPU) + `ggml-large-v3-turbo.bin`
  - Kaynak: huggingface.co/ggerganov/whisper.cpp, ~1.6 GB, SHA1 `4af2b29d7ec73d781377bfd1758ca957a807e941`
  - Lisans: MIT (whisper.cpp ve Whisper ağırlıkları)
  - Ölçülen: ~4 sn'lik Türkçe cümle ~1.6 sn'de yazıya çevrildi
- Ses dönüştürme: ffmpeg 8.1.1 (tarayıcının webm/mp4 kaydı → 16 kHz mono wav)
- TTS: macOS `say -v Yelda` (tr_TR), çevrimdışı

## İnternet gereken (bir kerelik) adımlar
1. `ollama pull qwen3.8` (zaten yapılmıştı)
2. Whisper modeli indirme (`models/ggml-large-v3-turbo.bin`)
3. `uv pip install -r backend/requirements.txt` ve `npm install`
4. İsteğe bağlı: Sistem Ayarları'ndan Yelda (Gelişmiş/Premium) ses paketi

## Yerel arama
- Gömme modeli: `nomic-embed-text` (Ollama, ~274 MB, Apache 2.0), 127.0.0.1:11434/api/embed
- Veri: `data/search/` altında 15 özgün, telifsiz demo belgesi (kişisel veri yok; ürün notu kurgusaldır)
- Ölçülen: arama ~0.02-0.04 sn, kaynaklı Qwen cevabı ~2-7 sn

## Türkçe ses (TTS), 2026-11-20 güncellemesi
- Kullanılan: **yazgı-tts-1** (`erkamk/yazgi-tts-1`, Hugging Face), Apache-2.0 (kod ve ağırlıklar; eğitim verisi atıfları paketin ATTRIBUTION.md dosyasında)
  - Ağırlıklar ~612 MB, `tts/hf-cache`; ortam `tts/.venv` (Python 3.12, CPU 4 iş parçacığı)
  - Servis: `tts/yazgi_server.py`, yalnızca 127.0.0.1:8777, `HF_HUB_OFFLINE=1`
  - Ölçülen: kısa cümle 0,35 sn, ~7 sn'lik cümle ~1 sn; Whisper geri okumasında cümleler ve "14:30", "22 derece" doğru
- Yedek: macOS `say -v Yelda` (compact)
- Karşılaştırılan diğerleri: Piper tr_TR-dfki (ses verisi CC BY-NC-SA), Chatterbox Multilingual (MIT, gerçek zamanın ~2 katı yavaş), FreyaTTS-small (anlaşılırlık zayıf)
