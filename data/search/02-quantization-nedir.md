---
title: Quantization: büyük modeller nasıl küçülür?
source: Yerel AI Notları
tags: quantization, nicemleme, 4-bit, model boyutu, bellek, GGUF, MLX
---
Quantization (nicemleme), model ağırlıklarını daha az bit ile saklama yöntemidir. 16 bitlik bir sayı yerine 4 veya 8 bitlik bir değer kullanıldığında model dosyası kabaca 2–4 kat küçülür ve daha az bellek ister.

Kaba bir hesap: 27 milyar parametreli bir model 16 bitte yaklaşık 54 GB yer tutarken 4 bit civarında 15–18 GB'a iner. Bu sayede 48 GB birleşik belleğe sahip bir dizüstü bilgisayarda çalıştırılabilir hâle gelir.

Bedeli, bir miktar doğruluk kaybıdır; ancak iyi yapılmış 4-bit modeller günlük kullanımda tam hassasiyetli modele oldukça yakın sonuç verir. Yaygın biçimler arasında GGUF (llama.cpp ailesi) ve MLX (Apple Silicon için) bulunur. Model seçerken parametre sayısı, quantization türü ve gereken bellek birlikte değerlendirilmelidir.
