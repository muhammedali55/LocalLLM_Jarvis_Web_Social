---
title: Cihaz üzerinde ses tanıma (yerel ASR)
source: Yerel AI Notları
tags: ses tanıma, ASR, Whisper, whisper.cpp, konuşmayı yazıya çevirme, mikrofon, Türkçe
---
Ses tanıma (ASR), konuşmayı yazıya çeviren teknolojidir. Whisper gibi açık modeller çok dilli eğitildiği için Türkçeyi de tanıyabilir. whisper.cpp, bu modelleri C/C++ ile hafif biçimde çalıştıran bir projedir ve Apple Silicon'da GPU hızlandırması kullanabilir.

Yerel ASR'de akış şöyledir: mikrofon kaydı alınır, 16 kHz tek kanallı sese dönüştürülür ve model bu sesi bilgisayarda metne çevirir. Ses hiçbir sunucuya gönderilmez.

Model boyutu doğruluk ve hız arasında bir tercih sunar. Küçük modeller hızlıdır ama Türkçede daha çok hata yapar; "large-v3-turbo" gibi modeller birkaç saniyelik bir cümleyi modern bir dizüstü bilgisayarda bir-iki saniyede yüksek doğrulukla yazıya çevirebilir. Tarayıcıların hazır konuşma tanıma özellikleri ise çoğu zaman sesi buluta gönderir; internetsiz senaryoda kullanılmamalıdır.
