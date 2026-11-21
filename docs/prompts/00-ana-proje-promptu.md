# İnternetsiz İnternet: Qwen ile Yerel AI Demo Projesi

> Bu, projeyi başlatırken yapay zekâ kodlama asistanına verilen ilk (ana) prompttur. Kişisel bilgiler çıkarılmıştır.
> This is the original master prompt given to the AI coding assistant at the start (in Turkish). Personal details removed.

## Yeni bir kodlama projesi için uygulama promptu

### Proje amacı

MacBook Pro M5 Pro (48 GB RAM) üzerinde, internet bağlantısı kesikken de çalışan üç yerel AI demosu geliştir:

1. **Google benzeri yerel arama:** Kullanıcı soru yazar; yerel Qwen cevap verir ve bilgisayarda önceden bulunan demo içeriklerinden sonuç listesi gösterir.
2. **Instagram/Facebook benzeri bot sitesi:** Yerel Qwen ile çalışan bot profilleri gönderi üretir ve birbirlerinin gönderilerine yorum yapar. Bu, gerçek Meta hesaplarına bağlanmayan yerel bir sosyal ağ simülasyonudur.
3. **Jarvis benzeri sesli yardımcı:** Kullanıcı Türkçe konuşur; ses yerel olarak yazıya çevrilir, Qwen cevabı yerel olarak üretir ve cevap sesli okunur.

Video fikrinin ana vaadi: **“İnternet kesikken yerel Qwen ile neler yapılabilir?”** Üç demo da çekim sırasında aynı MacBook üzerinde, Wi‑Fi kapalıyken çalışmalıdır. İnternet, yalnızca yazılımları ve model dosyalarını önceden indirip kurarken kullanılabilir.

### Çalışma biçimi

Bu dosyayı uygulama promptu olarak kullan. Önce bilgisayardaki ortamı incele, sonra en kısa çalışan yolu uygula. Her aşamada çalışan uygulamayı koru; gereksiz altyapı, üyelik, bulut servisi, dış API veya ücretli hizmet ekleme.

Başlamadan önce:

- Mac modelini, macOS sürümünü, kullanılabilir belleği ve disk alanını kontrol et.
- Kurulu araçları tespit et: Xcode Command Line Tools, Homebrew, Python, Node.js, Git, LM Studio/Ollama ve kullanılabilir yerel model dosyaları.
- **Qwen4 hedef modelini** ve Mac’te kullanılabilir yerel biçimini resmî model/çalıştırıcı kaynaklarından doğrula. Model adı, quantization, dosya boyutu, tahmini bellek ihtiyacı ve lisans bilgisini kısa bir preflight notunda yaz.
- Qwen4 çalıştırılamıyorsa başka modele sessizce geçme. Nedenini, uygun seçenekleri ve kullanıcıdan gereken kararı açıkça bildir. Model değişikliğini kullanıcı onayı olmadan yapma.
- Makinede zaten bulunan uygun araçları kullan. Yeni sistem yazılımı kurmak gerekiyorsa önce ne kurulacağını ve nedenini açıkla.
- Mevcut dosyaları veya projeleri kontrol et; hiçbir şeyi silme ya da üzerine yazma.

### Teknik hedef mimari

Tek bir yerel proje ve tek bir yerel Qwen servisi kullan:

- **Arayüz:** React + TypeScript + Vite; tarayıcıda yalnızca `localhost/127.0.0.1` üzerinden açılır.
- **Backend:** Python + FastAPI; UI ile yerel model arasında güvenli ve küçük bir API katmanı sağlar.
- **Model:** Öncelikli olarak Qwen4; LM Studio veya makinede zaten kurulu ve uyumlu başka bir yerel çalıştırıcı. Model seçimi preflight aşamasında doğrulanır. Yerel çalıştırıcı uyumlu yerel HTTP API sunabiliyorsa backend bu API’yi kullanır.
- **Arama verisi ve bot durumu:** Yerel JSON/Markdown dosyaları veya SQLite. İnternet kaynaklarına sorgu gönderilmez.
- **Türkçe ses tanıma:** Whisper.cpp veya resmî olarak belgelenmiş, Apple Silicon’da çalışan başka bir yerel ASR çözümü. Model dosyaları önceden indirilir. Tarayıcının bulut tabanlı Web Speech API’sini kullanma.
- **Sesli yanıt:** macOS’ta mevcutsa yerel ve çevrimdışı çalışan bir ses; değilse yerel TTS motoru. Ağ üzerinden ses üretimi kullanma.
- **Çevrimdışı arayüz:** CDN, dış font, uzaktaki ikon, Google Fonts, uzak görsel veya üçüncü taraf analytics kullanma. Gerekli görselleri ve ikonları projeye yerel ekle.

LM Studio’nun yerel sunucusu uygunsa OpenAI uyumlu yerel API üzerinden kullanılabilir. LM Studio belgeleri, indirilmiş modelle sohbetin, doküman aramasının ve yerel sunucunun çevrimdışı çalışabildiğini; model arama ve indirme gibi işlemler için internet gerektiğini belirtir. `whisper.cpp` deposu Apple Silicon desteğini ve cihaz üzerinde çevrimdışı çalışmayı belgeler. Bu bilgiler yalnızca başlangıç tercihleridir; uygulama sırasında güncel resmî belgeleri yeniden kontrol et.

### Demo 1 — Google benzeri yerel Qwen araması

Google’a benzeyen sade bir arama ekranı oluştur:

- Ortada arama alanı, arama düğmesi ve soru-cevap alanı.
- Soruyu Qwen4’e gönder; Qwen kısa, anlaşılır Türkçe yanıt üretsin.
- Yanıtın altında 3 adet sonuç kartı göster.
- Sonuçlar, uygulamaya önceden eklenmiş yerel demo içeriklerinden gelsin. Her kartta kaynak adı ve yerel dosya yolu/başlığı görünsün.
- Soru yerel verilerde yanıtlanamıyorsa Qwen’in uydurmasını önle: “Bu yerel demo verilerinde bulamadım” desin.
- Google araması yapıldığı, canlı web sonuçları bulunduğu veya internete bağlanıldığı izlenimini verme.
- Arayüzde küçük ve okunabilir bir “Yerel demo verileri” etiketi bulunsun.

Demo için 10–20 kısa ve telifsiz/özgün yerel içerik hazırla: örneğin AI, yazılım mimarisi, günlük teknoloji ve örnek ürün notları. Gerçek kişisel dosya, hesap, parola veya özel veri kullanma.

Örnek çekim sorgusu: **“Yerel yapay zekâ internetsiz nasıl çalışır?”** Qwen cevabı ve yerel kaynak listesi ekranda aynı anda görünsün.

### Demo 2 — Botların çalıştığı yerel sosyal site

Tek bir yerel web uygulamasında iki görünüm sun:

- **Instagram benzeri akış:** görsel kartlar, kısa açıklamalar, beğeni ve yorumlar.
- **Facebook benzeri akış:** metin gönderileri, topluluk/grup kartları, yorumlar.
- Üstte belirgin ama sade bir **“Yerel simülasyon”** rozeti.
- En az üç bot profili tanımla. Her birinin adı, kısa kişiliği ve yazım tarzı farklı olsun.
- “Botları çalıştır” düğmesiyle botlar sıralı biçimde gönderi oluştursun ve başka botların gönderilerine yorum yazsın.
- Gönderi ve yorumları Qwen4 yerel API’si üretsin; sonuçları yerel SQLite/JSON’da tut.
- Yanıtları ekranda görünür biçimde sıraya koy; model yükünü azaltmak için bot isteklerini paralel değil sıralı gönder.
- Kamera kaydında tekrar üretilebilirlik için sabit demo senaryosu/seed verisi sağla. Önceden hazırlanmış bir akış yükleme seçeneği bulunsun.
- Gerçek Instagram/Facebook hesabına giriş yapma, gerçek kullanıcı verisi çekme, platform API’lerine bağlanma, paylaşım yapma veya otomatik hesap işlemi yürütme.
- Gerçek marka arayüzü/servisiyle karıştırılmayacak görsel etiket kullan.

Örnek çekim: “Botları çalıştır”a bas; bir bot gönderi oluştursun, iki bot yorum yapsın. Wi‑Fi kapalıyken gönderi/yorum akışı oluşsun ve sayfa yenilendiğinde yerel kayıtlar korunsun.

### Demo 3 — Jarvis benzeri yerel sesli yardımcı

Yerel web arayüzünde “Konuş” düğmesi ile çalışan basit bir sesli yardımcı oluştur:

1. Kullanıcı düğmeye basılı tutar veya kaydı başlatıp bitirir.
2. Kayıt, internet kullanmadan yerel Türkçe ASR ile metne çevrilir.
3. Tanınan metin ekranda gösterilir ve kullanıcı isterse düzeltir.
4. Metin Qwen4’e yerel API üzerinden gönderilir.
5. Qwen yanıtı ekranda görünür ve yerel TTS ile sesli okunur.
6. “Tekrar dinle” ve “Temizle” kontrolleri bulunur.

Gereksinimler:

- Tarayıcının çevrimiçi konuşma tanıma özelliğini kullanma.
- Mikrofon izni ve kayıt durumunu anlaşılır göster.
- Mikrofon sesi ve transkript dosyalarını kalıcı olarak saklama; demo için gerekmedikçe kayıtları bellekte tutup işlem bitince sil.
- Bağlantı/servis kapalıysa anlaşılır hata mesajı göster; sessizce bulut servisine geçme.
- Türkçe kısa bir hazır soru ile demoyu önceden dene: **“Jarvis, yerel yapay zekâ bugün bana nasıl yardımcı olabilir?”**

### Ortak uygulama kuralları

- Uygulamayı tek komutla başlatıp durdurabilecek bir akış oluştur; örneğin `./start-local.sh` ve `./stop-local.sh`. İşletim sistemi ve kurulu araçlara uygun komutları seç.
- Backend yalnızca loopback adresine bağlansın; LAN’a açma.
- Model API anahtarı, bulut anahtarı veya kişisel kimlik bilgisi gerektirmesin. Yerel çalıştırıcı sahte bir anahtar alanı istiyorsa bunu yalnızca yerel placeholder olarak kullan.
- Bütün loglarda isteklerin yerel servise gittiği anlaşılır olsun; prompt veya ses içeriğini gereksiz yere diske yazma.
- UI’de gerçek olmayan Google sonuçlarını, sosyal medya hesaplarını veya canlı internet bağlantısını gerçekmiş gibi sunma.
- “0 TL” iddiası yalnızca bu demoda ücretli abonelik/API ödemesi yapılmadığı anlamına gelsin. Bilgisayar, elektrik, internetten önce model indirme ve kurulum emeğini maliyetten ayrı belirt.
- Proje kapsamını büyütme: kullanıcı girişi, dış servis entegrasyonu, gerçek sosyal hesaplar, dağıtım, ödeme, kapsamlı tasarım sistemi veya mobil uygulama geliştirme.
- Model cevapları/arayüz yavaşsa bunu gizlemek yerine gerçek gecikmeyi ölç; video çekiminde bekleme ekranı veya önceden hazırlanmış demo senaryosu kullan.

### Uygulama sırası

1. **Preflight:** Makine ve model uygunluğunu denetle; internet varken gereken indirmeleri listele. Kullanıcıdan onay gerektiren model değişikliğini veya büyük kurulumu uygulama.
2. **Yerel Qwen bağlantısı:** Modeli yerel çalıştırıcıda yükle; küçük bir Türkçe soru-cevap isteği yap; API adresinin loopback olduğunu doğrula.
3. **Ortak kabuk:** React/Vite + FastAPI iskeleti, sağlık kontrolü, durum göstergesi ve tek başlatma akışı.
4. **Google benzeri arama:** Yerel demo verisi, Qwen yanıtı ve kaynak kartlarını çalıştır.
5. **Sosyal simülasyon:** Üç yerel bot persona, sabit başlangıç akışı, gönderi/yorum üretimi ve kalıcı yerel kayıtlar.
6. **Jarvis:** Yerel ses kaydı, yerel ASR, Qwen yanıtı ve yerel TTS.
7. **Çevrimdışı son kontrol:** Model ve gerekli dosyalar indirildikten sonra Wi‑Fi’yi kapatıp uygulamayı baştan başlat. Her üç demoyu çalıştır; geliştirici araçları/ağ gözleminde dış servise istek olmadığını doğrula.
8. **Çekime hazırlık:** Üç demo için tutarlı ekran durumu, örnek sorgular, bot akışı ve Jarvis sorusunu hazırla. Çekim sırasında hiçbir kişisel hesap veya özel veri görünmesin.
9. **Teslim:** README, kurulum/indirme notları, çalıştırma/durdurma komutları, demo veri açıklaması, model bilgisi ve bilinen sınırları yaz.

### İlk 30 saniye çekim akışı

Sunucu ofis ortamında kameraya anlatır. Arama, sosyal akış ve Jarvis örnekleri ekranın sağı/solunda kısa ve ritmik kesmelerle görünür; her geçişte hafif “poonk” vurgu sesi kullanılır. İlk 30 saniyede kurulum anlatma; çalışan sonuçları göster.

| Süre | Görüntü ve aksiyon | Anlatım / ses |
|---|---|---|
| 0–4 sn | Wi‑Fi simgesi kapatılır; uygulama açık kalır. | “Şimdi interneti kapatıyorum.” Kısa vurgu sesi. |
| 4–10 sn | Google benzeri yerel aramada soru yazılır; Qwen yanıtı ve sonuç listesi belirir. | “Google gibi soruyorum; Qwen bilgisayarımdaki sonuçları getiriyor.” |
| 10–16 sn | Bot sosyal sitesinde “Botları çalıştır” düğmesi; gönderi ve yorumlar sırayla oluşur. | “Facebook ve Instagram benzeri akışta botlar gönderi paylaşıp birbirine cevap veriyor.” |
| 16–23 sn | Jarvis ekranında kullanıcı konuşur; transkript görünür; yerel sesli yanıt gelir. | “Sonra Jarvis’e konuşuyorum; sesimi yerelde tanıyor ve Qwen cevap veriyor.” |
| 23–27 sn | Üç demo kısa kesmelerle tekrar görünür; Wi‑Fi simgesi kapalı kalır. | “Üçü de bu Mac’te, internet yokken çalışıyor.” Bunu yalnızca çevrimdışı kontrolden sonra söyle. |
| 27–30 sn | Sunucu kameraya döner; uygulama ekranı arka planda kalır. | “Şimdi bu sistemi MacBook’ta nasıl kurduğumu göstereceğim.” |

Gösterilen her sonuç gerçekten çalışan uygulamadan alınmalı. Önceden hazırlanmış içerik kullanılırsa akışın demo verisi olduğu anlaşılmalı; gerçekleşmemiş özellikleri varmış gibi gösterme.

### 8–10 dakikalık video için çekim planı

- **0:00–0:30 — Sonuç montajı:** Yukarıdaki üç demoyu hızlı göster.
- **0:30–1:15 — Vaadi ve sınırları açıkla:** Yerel Qwen, internetsiz çalışma koşulu, internet açıkken model/araç indirme gereği.
- **1:15–2:15 — Kurulum ve mimari:** MacBook, yerel model çalıştırıcısı, web arayüzü ve backend bağlantısını kısa göster.
- **2:15–3:45 — Qwen arama ekranı:** Soru, cevap, yerel sonuç listesi ve kaynak göstergesi.
- **3:45–5:30 — Botların sosyal sitesi:** Bot profilleri, gönderi oluşturma, yorumlar, yerel kalıcılık.
- **5:30–7:30 — Jarvis:** Konuşma, yerel transkript, Qwen yanıtı, sesli dönüş.
- **7:30–8:30 — Wi‑Fi kapalı doğrulama:** Uygulamayı/ekranı göster; üç demoyu yeniden dene.
- **8:30–9:30 — Maliyet ve sonuç:** Abonelik/API maliyetini, kurulum/model indirme ve donanım sınırlarını dürüstçe ayır; hangi demoda Qwen’in gerçekten işe yaradığını özetle.

Teknik adımlar uzarsa kurulum ayrıntısını hızlandırılmış çekimle ver; sonuçları erken göster ve her bölümde yeni bir çalışan ekran sun.

### Kabul ölçütleri

Proje tamamlandı sayılabilmesi için:

- Qwen modelinin tam kimliği, dosya biçimi, quantization ve lisans bilgisi kaydedilmiş olmalı.
- Üç demo da MacBook Pro M5 Pro üzerinde yerel web arayüzünde açılmalı.
- Wi‑Fi kapalıyken yerel Qwen yanıtı alınmalı.
- Arama ekranı Qwen cevabını ve yerel veri kaynaklarını göstermeli; kaynakta bulunmayan bilgi için bunu açıkça söylemeli.
- Sosyal botlar yerel modelle gönderi ve yorum üretmeli; veriler uygulama yeniden açıldığında kalmalı.
- Jarvis Türkçe sesi yerel olarak yazıya çevirmeli, Qwen yanıtını göstermeli ve yerel sesle okumalı.
- Çevrimdışı kullanım sırasında uygulamadan Google, Meta, bulut AI, analytics, dış font veya uzaktaki speech API’lerine istek gitmemeli.
- Uygulama çalıştırma/durdurma talimatları README’de eksiksiz olmalı.
- Her iddia çekimde gösterilen gerçek davranışla aynı olmalı.

### Çekim başlıkları

Bu video için kullanıcı tarafından belirlenen A/B başlıkları:

1. **AI Aboneliklerini çöpe at, gerek kalmadı.**
2. **Aylık AI Aboneliklerine para ödeme devri bitti.**
3. **Tüm internet gittiğinde hâlâ AI kullanabilir misin?**

Kapak ve başlık seçimi proje promptunun kapsamı dışındadır; üretim sırasında seçilmiş olan A/B varyantlarını değiştirme.

### Resmî teknik başvuru bağlantıları

- LM Studio çevrimdışı çalışma: https://lmstudio.ai/docs/app/offline
- LM Studio yerel API sunucusu: https://lmstudio.ai/docs/developer/core/server
- LM Studio OpenAI uyumlu yerel uç noktalar: https://lmstudio.ai/docs/developer/openai-compat
- whisper.cpp (Apple Silicon ve yerel ASR): https://github.com/ggml-org/whisper.cpp

**Öncelik:** Önce çalışan, gerçek çevrimdışı dikey dilimleri çıkar; sonra görsel cilalama ve çekim düzenine geç. Hedef gösterişli maket değil, Wi‑Fi kapalıyken gerçekten çalışan ve videoda kanıtlanabilen üç demo.
