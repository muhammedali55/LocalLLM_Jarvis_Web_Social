---
title: Yerel model sunucusu ve loopback API
source: Yerel AI Notları
tags: Ollama, LM Studio, API, localhost, 127.0.0.1, loopback, sunucu, port
---
Yerel model çalıştırıcıları, modeli bir HTTP sunucusu arkasında sunar. Ollama varsayılan olarak 11434 numaralı portu, LM Studio ise 1234 portunu kullanır. Uygulamalar bu adrese istek göndererek modele soru sorar.

Güvenlik açısından önemli nokta, sunucunun yalnızca loopback adresine (127.0.0.1 veya localhost) bağlanmasıdır. Loopback adresi bilgisayarın kendisini gösterir; bu adrese bağlı bir servise aynı ağdaki başka cihazlar erişemez. Sunucu 0.0.0.0 adresine bağlanırsa yerel ağa açılmış olur.

Birçok yerel çalıştırıcı OpenAI uyumlu uç noktalar da sunar. Böylece bulut API'si için yazılmış bir uygulama, adresi yerel sunucuya çevrilerek internetsiz çalıştırılabilir. Bu durumda API anahtarı alanı gerekiyorsa yalnızca yer tutucu bir değer yazılır.
