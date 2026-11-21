---
title: Yerel belgelerle arama (RAG)
source: Yerel AI Notları
tags: RAG, arama, embedding, vektör, kaynak, belge, uydurma, halüsinasyon
---
RAG (Retrieval-Augmented Generation), modele soru sormadan önce ilgili belgeleri bulup bu belgeleri soruyla birlikte modele vermek demektir. Model, kendi hafızası yerine önüne konan metne dayanarak yanıt üretir.

Yerel bir RAG sistemi üç adımdan oluşur: belgeler parçalara ayrılıp sayısal vektörlere (embedding) çevrilir; kullanıcının sorusu da vektöre çevrilip en benzer belgeler bulunur; bulunan belgeler bir talimatla birlikte dil modeline gönderilir. Anahtar kelime eşleşmesi ile vektör benzerliğini birlikte kullanmak genellikle daha iyi sonuç verir.

RAG'in en önemli faydası uydurmayı (halüsinasyonu) azaltmasıdır. Modele "yalnızca verilen kaynaklara dayan, kaynakta yoksa bulamadığını söyle" talimatı verilir ve yanıtın hangi belgeden geldiği kullanıcıya gösterilir.
