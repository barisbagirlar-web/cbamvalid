# G-18 — PDF/UA Erişilebilirlik Uygunluğu — DURUM: BLOCKED

## Karar (kullanıcı onayı, RM-CBAMVALID-007)

G-18 bu sprintte **BLOCKED** olarak işaretlenmiştir. Kullanıcı kararı:

> jsPDF etiketli yapı ağacı üretmediği ve pdf-lib'in bunu güvenilir şekilde
> retrofit edemediği biliniyor. G-18'i sahte yeşil yapma; gerçek etiketleme
> desteği olan bir araç araştır ya da BLOCKED bırak. Kırmızı test, sahte
> yeşilden daha güvenilirdir.

Kırmızı tarama sonucu, sahte yeşil PASS'tan daha güvenilir kabul edilmiştir.

## Kapanma şartları (spike çıktıları)

- [ ] Tagged-PDF üretebilen bir üretim yolu araştırıldı (ör. `pdf-lib` etiketli
      yapı ağacı desteği, harici dönüştürücü, gerçek tagged-PDF kütüphanesi).
- [ ] Master Record PDF/UA taramasından sıfır kritik ihlalle geçiyor.
- [ ] `pac-accessibility-check.sh` (veya eşdeğeri) CI'a bağlandı.

## Bu sprintte yapılan hazırlık

`scripts/gates/pac-accessibility-check.sh` — PAC 3 (PDF Accessibility
Checker) veya eşdeğeri araç kuruluysa PDF/UA taraması yapar, kurulu değilse
`KANIT_YOK` (exit 2) raporlar. `verapdf-conformance-check.sh` ile aynı
fail-closed davranışı.

## Fiyat kapısına etkisi

G-18 BLOCKED → RTM satırı `R-04` `IN_PROGRESS` kalır. **$1.990 kapısı G-18
kapanmadan açılamaz.** Mevcut $449 satış kanalı G-18'den bağımsız devam eder.
