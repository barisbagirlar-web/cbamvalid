# G-23 — İş Sürekliliği Planı (Tek Kurucu Riski) — TASLAK

> **Durum:** TASLAK — insan incelemesi ve imza gerekli.
> **Sahip:** Kurucu-mühendis. İmza aşağıdadır.
> **Kalite çıtası:** Bu plan imzalanmadan kurumsal/çoklu kurulum katmanı
> satışa açılamaz (G-23 ROLLBACK). Satış fiyatı sabit **$449 USD**'dir.

## 1. Kapsam

CBAMValid tek kurucu-mühendis tarafından geliştirilmektedir. Bu plan,
kurucunun geçici veya kalıcı erişilemezliğinde ürünün sürekliliğini ve müşteri
verisi bütünlüğünü güvence altına alır.

## 2. Kontrol listesi

- [ ] **Kaynak kodu emanet (escrow):** Kod deposu en az iki bağımsız konumda
      tutuluyor (git uzakları + günlük yedek). Emanet anlaşması var mı?
- [ ] **İmzalama anahtarları:** İmzalama anahtarı düz metin olarak yalnızca
      HSM'de (AWS KMS / GCP Cloud HSM / Azure Key Vault) duruyor. İkinci
      kullanıcı/rol anahtar erişimi tanımlı mı?
- [ ] **Müşteri verisi yedekleme/kurtarma:** Firestore yedekleme periyodu ve
      kurtarma RPO/RTO hedefleri belgeli mi?
- [ ] **Destek süreklilik planı:** G-24 SLA'sı, ikinci destek kişisi olmadan
      geçerli mi? (Dokümante edilmiş runbook)
- [ ] **Entitlement/ödeme işlemleri:** Paddle hesabı erişim sürekliliği ve
      müşteri lisans kayıtlarının yedeği belgeli mi?

## 3. Kurtarma prosedürü

1. Erişilemezlik > 48 saat: yedek erişim kişisi (varsa) devreye girer.
2. Kod: uzak depolardan yeni makineye restore; CI sırasında tüm gate'ler
   koşulur.
3. Veri: son Firestore yedeğinden restore; RPO ≤ 24 saat.
4. Anahtar: HSM rol yedek kullanıcısı ile imzalama testi.
5. Müşteri iletişimi: SLA P0/P1 kanallarından durum bildirimi.

## 4. İmza

| Rol | Ad | Tarih | İmza |
|---|---|---|---|
| Kurucu-mühendis | | | |
| Yedek erişim kişisi | | | |
