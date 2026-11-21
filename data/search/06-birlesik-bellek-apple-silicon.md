---
title: Birleşik bellek ve büyük modeller
source: Yerel AI Notları
tags: Apple Silicon, birleşik bellek, unified memory, RAM, GPU, Mac, M serisi
---
Apple Silicon işlemcilerde CPU ve GPU aynı belleği paylaşır; buna birleşik bellek denir. Klasik bilgisayarlarda modelin GPU'da çalışması için ayrı ekran kartı belleğine (VRAM) sığması gerekir. Birleşik bellekte ise sistem belleğinin büyük kısmı GPU tarafından kullanılabilir.

Bu, büyük dil modelleri için önemli bir avantajdır. 48 GB birleşik belleğe sahip bir Mac, 4-bit quantization ile 20–30 milyar parametreli modelleri belleğe sığdırabilir ve kalan bellekle işletim sistemi ile diğer uygulamaları çalıştırmaya devam edebilir.

Üretim hızı büyük ölçüde bellek bant genişliğine bağlıdır: model her kelime üretiminde ağırlıkların önemli bir kısmını okur. Bu yüzden aynı model, daha yüksek bant genişliğine sahip işlemcilerde saniyede daha fazla kelime üretir.
