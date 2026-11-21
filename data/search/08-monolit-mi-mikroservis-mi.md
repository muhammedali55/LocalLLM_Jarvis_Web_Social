---
title: Monolit mi, mikroservis mi?
source: Mimari Defteri
tags: yazılım mimarisi, mikroservis, monolit, ölçekleme, ekip, dağıtım
---
Monolit mimaride uygulamanın tüm parçaları tek bir kod tabanında ve tek bir dağıtım biriminde bulunur. Mikroservis mimarisinde ise uygulama, her biri kendi sorumluluğuna sahip ve ayrı dağıtılabilen küçük servislere bölünür.

Küçük ekipler ve yeni ürünler için monolit genellikle daha hızlı ve basittir: tek depo, tek dağıtım, kolay hata ayıklama. Mikroservisler ise ekipler büyüdüğünde, parçaların bağımsız ölçeklenmesi gerektiğinde veya farklı teknolojiler kullanılması istendiğinde avantaj sağlar.

Mikroservislerin bedeli; ağ gecikmesi, dağıtık hata yönetimi, izleme ve veri tutarlılığı gibi ek karmaşıklıklardır. Yaygın bir öneri, iyi modüllere ayrılmış bir monolitle başlamak ve gerçekten ihtiyaç duyulan sınırları sonradan ayrı servislere çıkarmaktır.
