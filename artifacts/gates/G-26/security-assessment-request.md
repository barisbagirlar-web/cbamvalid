# G-26 — Bağımsız Güvenlik İncelemesi — DEĞERLENDİRME GÖREV TANIMI

> **Durum:** AÇIK — dış denetçi/bağımsız inceleyici atanması gerekli.
> **Fiyat kapısı:** Kritik/yüksek bulgu sayısı sıfır olmadan $1.990 kapısı
> açılamaz; $449 ile satış devam edebilir.

## 1. İnceleme kapsamı (görev tanımı)

Aşağıdaki üretim yüzeyi bağımsız olarak incelenir:

| Bileşen | Konum |
|---|---|
| İmza + zaman damgası hattı | `functions/src/cbam/report/kms-signature.ts`, `functions/src/dossier/70-seal/tsa.ts`, `tsa-client.ts` |
| Kanonik serileştirme (RFC 8785) | `functions/src/cbam/report/v6/jcs.ts` |
| Mühürleme servisi | `functions/src/cbam/report/seal-service.ts` |
| Doğrulama CLI (Node + Python) | `scripts/verify/cli.js`, `scripts/verify/cli.py` |
| Erişim kontrolü / API uçları | `functions/src/handlers/*.ts` |

## 2. Beklenen inceleme başlıkları

- Kriptografik uygulama: RSA-4096 PSS parametreleri, salt uzunluğu, RFC 3161
  TSR doğrulama akışı.
- Kanalonik serileştirme determinizmi ve float-enjeksiyon yüzeyi (G-16).
- İmza doğrulama yolunda alıcı taraf güvenliği (schema-aware verify).
- Yetkilendirme/tenant izolasyonu, kimlik doğrulama eksikleri.
- Açık kaynak bağımlılık taraması (npm audit + Python paket taraması).
- Sır yönetimi (anahtar düz metin olmaması, ortam değişkenleri).

## 3. Rapor çıktısı

- `artifacts/gates/G-26/independent-security-assessment.pdf` (imzalı rapor).
- Bulgu şiddeti: Kritik / Yüksek / Orta / Düşük. **Kritik+Yüksek = 0** şartı.
- Orta bulgular için kapatma planı ve tarih.

## 4. İnceleyici onayı

| Rol | Ad | Kurum | Tarih | İmza |
|---|---|---|---|---|
| Bağımsız inceleyici | | | | |
| Kurucu (onay) | | | | |
