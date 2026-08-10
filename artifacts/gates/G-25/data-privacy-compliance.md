# G-25 — Veri Gizliliği ve KVKK/GDPR Uygunluk Belgesi — TASLAK

> **Durum:** TASLAK — insan incelemesi, üçüncü taraf denetim (önerilen) ve
> imza gerekli. **ROLLBACK (mutlak):** Uygunluk sağlanmadan hiçbir müşteri
> verisi işlenemez — kalite çıtasından bağımsız kısıtlama.

## 1. Kapsam

CBAM dosyaları ticari sır niteliğinde veri içerir (üretim miktarları, emisyon
değerleri, tedarikçi bilgileri). Bu belge veri işleme yaşam döngüsünü tanımlar:
toplama → işleme → saklama → imha, KVKK (Türkiye) ve GDPR (AB müşterileri).

## 2. Kontrol listesi

- [ ] **At-rest şifreleme:** Kanıt dosyaları ve paket artefaktları AES-256 ile
      şifreleniyor (Firestore/Cloud Storage varsayılan şifrelemesi + paket
      içi gerekçeler).
- [ ] **Transit şifreleme:** Tüm istemci→sunucu ve sunucu→depolama trafiği
      TLS 1.3 (Firebase/Next.js host yapılandırması).
- [ ] **Saklama/silme politikası:** Saklama süresi (raporlama dönemi + yasal
      süre), silme talebi mekanizması (`DELETE /cases/{caseId}` +
      entitlement iadesi) yazılı mı?
- [ ] **Aydınlatma metni:** KVKK m.10 ve GDPR md.13 kapsamında aydınlatma
      metni mevcut mu (veri sorumlusu, amaç, hukuki sebep, haklar)?
- [ ] **Alt işleyici şeffaflığı:** Firebase, Paddle (ödeme), OpenAI/LLM (varsa)
      alt işleyici listesi ve işleme anlaşmaları belgeli mi?
- [ ] **Ticari sır koruması:** Müşteri dosya içerikleri hiçbir model eğitimine
      veya üçüncü taraf analizine girmiyor mu?

## 3. Veri akışı ve yetki

| Aşama | Veri | Saklama | Şifreleme | İmha |
|---|---|---|---|---|
| Oluşturma (wizard) | Case girdileri | Firestore, aktif dönem | At-rest AES-256 | Silme talebi + 30 gün |
| Hesaplama | Emisyon değerleri | Fonksiyon hafızası | — | İşlem sonu |
| Mühürleme | Paket artefaktları | Cloud Storage | At-rest AES-256 | Silme talebi |
| Ödeme | Paddle müşteri kaydı | Paddle (alt işleyici) | — | Paddle politikası |

## 4. İmza

| Rol | Ad | Tarih | İmza |
|---|---|---|---|
| Veri sorumlusu (Kurucu) | | | |
| Hukuk/denetim (önerilen) | | | |
