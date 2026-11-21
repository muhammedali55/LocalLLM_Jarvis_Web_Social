---
title: İyi bir REST API nasıl tasarlanır?
source: Mimari Defteri
tags: API, REST, HTTP, endpoint, durum kodu, sürümleme
---
REST API'lerde kaynaklar isimlerle (örneğin /siparisler) ifade edilir, yapılacak işlem ise HTTP yöntemiyle belirtilir: GET okur, POST oluşturur, PUT/PATCH günceller, DELETE siler.

Doğru durum kodları istemcinin işini kolaylaştırır: 200 başarılı, 201 oluşturuldu, 400 hatalı istek, 404 bulunamadı, 503 servis kullanılamıyor. Hata yanıtlarında kullanıcıya anlaşılır bir mesaj döndürmek, yalnızca kod göndermekten daha faydalıdır.

İyi bir API ayrıca girişleri doğrular (uzunluk ve tip sınırları), sayfalama sunar ve geriye dönük uyumluluğu korumak için sürümlenir (/v1/...). Yerel bir uygulamada bile backend'in yalnızca loopback adresinden erişilebilir olması ve gereksiz uç nokta açmaması iyi bir alışkanlıktır.
