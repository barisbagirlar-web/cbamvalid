# CBAMVALID-DOSSIER-7.0 — Uygulama Durumu Kaydı

**Mandate:** RM-CBAMVALID-007 (Enterprise Compliance Master Record · $1.990 kalite çıtası — metafor; satış fiyatı sabit **$449 USD**)
**Durum:** KISMİ — yazılım kapıları tamamlanıyor, insan kapıları ve kalite çıtası ilanı bekliyor.
**Tarih:** 2026-08-10

> Bu kayıt, kullanıcının verdiği RM-CBAMVALID-007 mandate dokümanının
> uygulanmış halini yansıtır. Mandate'in orijinal metni bu repo dışındadır;
> aşağıdaki tablolar uygulanan değişikliklere göre güncellenmiştir.

## 1. Kapı durumu

| Kapı | Konu | Durum | Kanıt / Not |
|---|---|---|---|
| G-15 | Kanonik serileştirme determinizmi | **PASS** | RFC 8785 resmi vektörler + Node/Python cross-runtime (`artifacts/gates/G-15/`) |
| G-16 | Ondalık hassasiyet / float yasağı | **PASS** | ESLint kuralı + runtime guard (`artifacts/gates/G-16/`) |
| G-17 | PDF/A-3b arşiv + gömülü kaynak | **PASS** (ekler) / KANIT_YOK (veraPDF) | Ekler round-trip testi; veraPDF kurulumu bekliyor (`artifacts/gates/G-17/`) |
| G-18 | PDF/UA erişilebilirlik | **BLOCKED** | Kullanıcı onayı: sahte yeşil yerine BLOCKED + spike (`artifacts/gates/G-18/`) |
| G-19 | RSA-4096 PSS + RFC 3161 TSA | **PASS** | PSS üretim/doğrulama + geriye dönük PKCS1v1.5 + OpenSSL TSA testi (`artifacts/gates/G-19/`) |
| G-20 | Çoklu runtime yeniden üretilebilirlik | **PASS** | `scripts/verify/cli.py` + `jcs.py`, Node/Python 7 senaryo birebir (`artifacts/gates/G-20/`) |
| G-21 | Hukuki kaynak tazeliği | **PASS** | 90 gün kapısı + fail-closed (`artifacts/gates/G-21/`) |
| G-22 | Para birimi / birim tutarlılığı | **PASS** | ALLOWED_CURRENCIES + tCO2e ailesi (`artifacts/gates/G-22/`) |
| G-23 | İş sürekliliği (tek kurucu) | **TASLAK** | `artifacts/gates/G-23/business-continuity-plan.md` — imza bekliyor |
| G-24 | Destek SLA | **TASLAK** | `artifacts/gates/G-24/support-sla.md` — yayın URL'si bekliyor |
| G-25 | Veri gizliliği KVKK/GDPR | **TASLAK** | `artifacts/gates/G-25/data-privacy-compliance.md` — imza bekliyor |
| G-26 | Bağımsız güvenlik incelemesi | **AÇIK** | `artifacts/gates/G-26/security-assessment-request.md` — denetçi atanması bekliyor |

v6 kapıları (G-01→G-14): yeniden doğrulanmıştır — tüm v6 gate testleri bu
sürümde yeşildir (226 test dosyası / 1027 test PASS).

## 2. Uygulanan teknik değişiklikler

1. **Şema 7.0 / engine 4.1.0:** `CBAMVALID-DOSSIER-7.0` üretim manifest şeması,
   `CALCULATION_ENGINE_VERSION = "4.1.0"`. Eski şemalar (4.0/5.0/6.0) geriye
   dönük doğrulanabilir kalır (`verifier-package-builder.ts`, `seal-service.ts`,
   `commercial-report-pipeline-v2.ts`, `premium-dossier-schema.ts`).
2. **RFC 8785 (JCS):** Tüm hash girişi `functions/src/cbam/report/v6/jcs.ts`
   üzerinden kanonik serileştiriliyor; Python eşdeğeri `scripts/verify/jcs.py`.
3. **G-16:** `scripts/lint/no-float-in-hashed-fields.mjs` ESLint kuralı + hash
   öncesi runtime float denetimi.
4. **G-19:** `kms-signature.ts` RSA-PSS destekli (schema-aware); RFC 3161
   istemcisi `functions/src/dossier/70-seal/tsa-client.ts`; OpenSSL ile
   doğrulanmış TSA testi.
5. **G-20:** `scripts/verify/cli.py` Node CLI ile birebir; 7 senaryo.
6. **G-17:** `pdf-archive-embeddings.ts` — manifest/trace/verify CLI gömülü ek,
   PDF/A XMP metadata; `scripts/gates/verapdf-conformance-check.sh`.
7. **G-18:** `scripts/gates/pac-accessibility-check.sh` (BLOCKED — spike).

## 3. RTM özeti

- R-01..R-08 (yazılım): G-15..G-22 ile kapatıldı.
- R-09..R-12 (insan kapıları): G-23..G-26 taslak/AÇIK — **CLOSED değil**.
- **$1.990 kalite çıtası:** AÇIK DEĞİL. DoD maddelerinden G-18 (BLOCKED),
  G-23..G-26 (imza/denetçi) ve veraPDF raporu tamamlanmadan kalite çıtası ilan
  edilemez. Satış fiyatı bu kriterlerden bağımsız olarak sabit **$449 USD**'dir.

## 4. Sonraki adımlar

1. veraPDF kurulumu + G-17 tam konformans taraması.
2. G-18 spike (gerçek tagged-PDF üretim yolu araştırması).
3. G-23..G-26 belgelerinin insan incelemesi ve imzası.
4. Canlı ortamda uçtan uca satın alma testi (Paddle, $449) + insan doğrulama.
5. $1.990 kalite çıtası ilanı (fiyat geçişi yok — satış fiyatı sabit $449).
