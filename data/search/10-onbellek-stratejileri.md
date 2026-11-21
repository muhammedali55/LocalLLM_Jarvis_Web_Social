---
title: Önbellek (cache) stratejileri
source: Mimari Defteri
tags: önbellek, cache, performans, TTL, gecikme, Redis
---
Önbellek, sık kullanılan bir sonucu yeniden hesaplamak yerine hızlı erişilebilir bir yerde saklamaktır. Doğru kullanıldığında yanıt süresini ciddi biçimde azaltır ve arka plandaki sistemlerin yükünü düşürür.

Yaygın yaklaşımlar şunlardır: "cache-aside" yönteminde uygulama önce önbelleğe bakar, yoksa veriyi kaynaktan alıp önbelleğe yazar. TTL (yaşam süresi) ile kayıtlar belirli bir süre sonra otomatik geçersiz olur. Yazma anında önbelleği güncelleyen "write-through" yöntemi ise tutarlılığı artırır.

Önbelleğin zor kısmı geçersiz kılmadır: veri değiştiğinde eski sonucun gösterilmemesi gerekir. Yapay zekâ uygulamalarında da önbellek işe yarar; örneğin belgelerin embedding vektörleri bir kez hesaplanıp diske kaydedilirse arama her açılışta yeniden hesaplama yapmaz.
