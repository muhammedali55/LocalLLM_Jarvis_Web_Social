---
title: Gizlilik: verim bilgisayarımda kalır mı?
source: Yerel AI Notları
tags: gizlilik, veri, bulut, kişisel veri, güvenlik, KVKK
---
Bulut tabanlı yapay zekâ hizmetlerinde yazdığınız metin, yüklediğiniz dosya veya konuştuğunuz ses, işlenmek için hizmet sağlayıcının sunucularına gönderilir. Yerel modelde ise istem ve yanıt bilgisayardan çıkmaz.

Yine de "yerel" olmak tek başına tam gizlilik garantisi değildir. Uygulamanın loglara ne yazdığı, geçici dosyaları silip silmediği ve dışarıya istek gönderip göndermediği ayrıca kontrol edilmelidir. İyi bir yerel uygulama ses kayıtlarını işlem bittikten sonra siler, istem içeriğini loglamaz ve yalnızca loopback adresindeki servislere bağlanır.

Bunu doğrulamanın pratik yolu, Wi‑Fi kapalıyken uygulamayı denemek ve tarayıcının geliştirici araçlarında ağ isteklerini incelemektir. Tüm istekler 127.0.0.1 adresine gidiyorsa veri bilgisayarda kalıyordur.
