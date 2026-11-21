---
title: Yerel yapay zekâ internetsiz nasıl çalışır?
source: Yerel AI Notları
tags: yerel model, çevrimdışı, internetsiz, offline, cihaz üzerinde, LLM, Qwen
---
Yerel yapay zekâ, dil modelinin ağırlık dosyalarının bilgisayarın diskine önceden indirilmesi ve hesaplamanın bu bilgisayarın kendi işlemcisi, GPU'su ve belleğiyle yapılması demektir. Model bir kez indirildikten sonra soru sorup yanıt almak için internete ihtiyaç yoktur; her kelime cihaz üzerinde, bir önceki kelimelere bakılarak tek tek üretilir.

Bu düzende genellikle üç parça bulunur: model dosyası (örneğin 15–20 GB'lık bir Qwen modeli), modeli belleğe yükleyip çalıştıran bir yerel çalıştırıcı (Ollama veya LM Studio gibi) ve bu çalıştırıcıya yalnızca 127.0.0.1 adresinden bağlanan bir uygulama. İnternet yalnızca kurulum aşamasında, model ve araçlar indirilirken gerekir.

Yerel modelin bilgisi eğitim tarihine kadar olan veriyle sınırlıdır. Güncel haber, hava durumu veya canlı fiyat gibi bilgileri internetsiz bilemez; bu yüzden yerel belgelerle birlikte kullanılması (yerel arama) daha güvenilir sonuç verir.
