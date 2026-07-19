#!/bin/bash
# ============================================================================
# UNIVERSAL SEO STRES TESTİ v3.1 — macOS/Linux Cross-Compatible
# TARGETS: drfin.com.tr, isplani.com.tr, cbamvalid.com, sectorcalc.com
# MODE: Zero-Defect | POSIX-Safe | Single Final Report
# ============================================================================

# macOS Bash 3.2 safe: set -e kullan ama arithmetic expansion'dan kaçın
set -uo pipefail

DOMAINS="drfin.com.tr isplani.com.tr cbamvalid.com sectorcalc.com"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="SEO_STRESS_TEST_FINAL_REPORT_${TIMESTAMP}.json"

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0
RESULTS=""

# ─── HELPER: Ekleme fonksiyonu (Bash 3.2 safe) ───
add_result() {
    local domain="$1" test_name="$2" status="$3" detail="$4"
    local escaped_detail
    escaped_detail=$(printf '%s' "$detail" | sed 's/"/\\"/g; s/\n/\\n/g')
    
    if [ -n "$RESULTS" ]; then
        RESULTS="${RESULTS},"
    fi
    RESULTS="${RESULTS}{\"domain\":\"${domain}\",\"test\":\"${test_name}\",\"status\":\"${status}\",\"detail\":\"${escaped_detail}\"}"
    
    case "$status" in
        PASS) PASS_COUNT=$((PASS_COUNT + 1)) ;;
        FAIL) FAIL_COUNT=$((FAIL_COUNT + 1)) ;;
        WARN) WARN_COUNT=$((WARN_COUNT + 1)) ;;
    esac
}

# ─── HELPER: Portable grep extraction (BSD + GNU) ───
# grep -oE works on both BSD and GNU grep
extract_first() {
    local pattern="$1"
    grep -oE "$pattern" 2>/dev/null | head -1 || true
}

echo "🚀 UNIVERSAL SEO STRES TESTİ v3.1 (macOS Compatible)"
echo "📅 Tarih: $(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S')"
echo "🎯 Hedefler: ${DOMAINS}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

for DOMAIN in $DOMAINS; do
    echo ""
    echo "🔍 DOMAIN: $DOMAIN"
    echo "─────────────────────────────────────"

    # ═══════════════════════════════════════════
    # TEST 01: L1 CANONICAL & HSTS
    # ═══════════════════════════════════════════
    echo "  [01/12] L1 Canonical & HSTS..."
    
    WWW_HEADERS=$(curl -sI "https://www.${DOMAIN}/" 2>/dev/null || true)
    NON_WWW_HEADERS=$(curl -sI "https://${DOMAIN}/" 2>/dev/null || true)
    
    HSTS_CHECK=$(echo "$WWW_HEADERS" | grep -ci "strict-transport-security" 2>/dev/null || echo "0")
    NON_WWW_STATUS=$(echo "$NON_WWW_HEADERS" | head -1 | extract_first '[0-9]{3}')
    NON_WWW_LOCATION=$(echo "$NON_WWW_HEADERS" | grep -i "^location:" | head -1 | sed 's/[Ll]ocation: *//i' | tr -d '\r')
    
    if [ "$HSTS_CHECK" -ge 1 ] 2>/dev/null && [ "$NON_WWW_STATUS" = "301" ]; then
        add_result "$DOMAIN" "L1_Canonical_HSTS" "PASS" "HSTS aktif, non-www 301 -> ${NON_WWW_LOCATION}"
        echo "    ✅ PASS"
    else
        add_result "$DOMAIN" "L1_Canonical_HSTS" "FAIL" "HSTS=${HSTS_CHECK}, NonWWW_Status=${NON_WWW_STATUS}, Location=${NON_WWW_LOCATION}"
        echo "    ❌ FAIL: HSTS=${HSTS_CHECK}, Status=${NON_WWW_STATUS}"
    fi

    # ═══════════════════════════════════════════
    # TEST 02: L2/L3 XML ENVELOPE
    # ═══════════════════════════════════════════
    echo "  [02/12] L2/L3 XML Zarfı..."
    
    SITEMAP_HEAD=$(curl -s "https://${DOMAIN}/sitemap.xml" 2>/dev/null | head -5 || true)
    
    HAS_XML_DECL=$(echo "$SITEMAP_HEAD" | grep -c '<?xml' 2>/dev/null || echo "0")
    HAS_SITEMAPINDEX=$(echo "$SITEMAP_HEAD" | grep -c '<sitemapindex' 2>/dev/null || echo "0")
    
    if [ "$HAS_XML_DECL" -ge 1 ] 2>/dev/null && [ "$HAS_SITEMAPINDEX" -ge 1 ] 2>/dev/null; then
        add_result "$DOMAIN" "L2_XML_Envelope" "PASS" "XML decl + sitemapindex kök elementi mevcut"
        echo "    ✅ PASS"
    else
        FIRST_LINE=$(echo "$SITEMAP_HEAD" | head -1 | cut -c1-80)
        add_result "$DOMAIN" "L2_XML_Envelope" "FAIL" "Zarf eksik. İlk satır: ${FIRST_LINE}"
        echo "    ❌ FAIL: xml_decl=${HAS_XML_DECL}, sitemapindex=${HAS_SITEMAPINDEX}"
    fi

    # ═══════════════════════════════════════════
    # TEST 03: L2 CONTENT-TYPE HEADER
    # ═══════════════════════════════════════════
    echo "  [03/12] L2 Content-Type Header..."
    
    CT_HEADER=$(curl -sI "https://${DOMAIN}/sitemap.xml" 2>/dev/null | grep -i "content-type" | head -1 || true)
    HAS_APP_XML=$(echo "$CT_HEADER" | grep -ci "application/xml" 2>/dev/null || echo "0")
    
    if [ "$HAS_APP_XML" -ge 1 ] 2>/dev/null; then
        add_result "$DOMAIN" "L2_Content_Type" "PASS" "application/xml header doğru"
        echo "    ✅ PASS"
    else
        add_result "$DOMAIN" "L2_Content_Type" "FAIL" "Header: ${CT_HEADER}"
        echo "    ❌ FAIL: ${CT_HEADER}"
    fi

    # ═══════════════════════════════════════════
    # TEST 04: L4 DUPLICATE URL CROSS-CHECK
    # ═══════════════════════════════════════════
    echo "  [04/12] L4 Duplicate URL Cross-Check..."
    
    ALL_URLS_TMP=$(mktemp)
    SUB_SITEMAPS=$(curl -s "https://${DOMAIN}/sitemap.xml" 2>/dev/null | extract_first '<loc>[^<]+</loc>' | sed 's/<[^>]*>//g' || true)
    
    DUP_FOUND=0
    if [ -n "$SUB_SITEMAPS" ]; then
        for SM in $SUB_SITEMAPS; do
            curl -s "$SM" 2>/dev/null | extract_first '<loc>[^<]+</loc>' | sed 's/<[^>]*>//g' >> "$ALL_URLS_TMP" 2>/dev/null || true
        done
        DUP_FOUND=$(sort "$ALL_URLS_TMP" 2>/dev/null | uniq -d | wc -l | tr -d ' ' || echo "0")
    fi
    rm -f "$ALL_URLS_TMP"
    
    if [ "$DUP_FOUND" -eq 0 ] 2>/dev/null; then
        add_result "$DOMAIN" "L4_Duplicate_URLs" "PASS" "Alt sitemap'ler arası duplicate yok"
        echo "    ✅ PASS"
    else
        add_result "$DOMAIN" "L4_Duplicate_URLs" "FAIL" "${DUP_FOUND} duplicate URL tespit edildi"
        echo "    ❌ FAIL: ${DUP_FOUND} duplicate URL"
    fi

    # ═══════════════════════════════════════════
    # TEST 05: L5 LASTMOD MONOCULTURE (INDEX)
    # ═══════════════════════════════════════════
    echo "  [05/12] L5 Lastmod Monokültür (İndeks)..."
    
    INDEX_CONTENT=$(curl -s "https://${DOMAIN}/sitemap.xml" 2>/dev/null || true)
    INDEX_DATES=$(echo "$INDEX_CONTENT" | grep -oE '<lastmod>[^<]+</lastmod>' | sed 's/<[^>]*>//g' || true)
    
    if [ -n "$INDEX_DATES" ]; then
        TOTAL_DATES=$(echo "$INDEX_DATES" | wc -l | tr -d ' ')
        MAX_REPEAT=$(echo "$INDEX_DATES" | sort | uniq -c | sort -rn | head -1 | awk '{print $1}')
        
        if [ "$TOTAL_DATES" -gt 0 ] 2>/dev/null; then
            # Integer division for Bash 3.2 compatibility
            RATIO_INT=$((MAX_REPEAT * 100 / TOTAL_DATES))
            
            if [ "$RATIO_INT" -lt 60 ] 2>/dev/null; then
                add_result "$DOMAIN" "L5_Monoculture_Index" "PASS" "Monokültür oranı: %${RATIO_INT} (<%60)"
                echo "    ✅ PASS: %${RATIO_INT}"
            else
                add_result "$DOMAIN" "L5_Monoculture_Index" "FAIL" "Monokültür oranı: %${RATIO_INT} (>=%60)"
                echo "    ❌ FAIL: %${RATIO_INT}"
            fi
        else
            add_result "$DOMAIN" "L5_Monoculture_Index" "WARN" "lastmod verisi bulunamadı"
            echo "    ⚠️ WARN: lastmod verisi yok"
        fi
    else
        add_result "$DOMAIN" "L5_Monoculture_Index" "FAIL" "İndeks dosyasında lastmod yok"
        echo "    ❌ FAIL: lastmod yok"
    fi

    # ═══════════════════════════════════════════
    # TEST 06: L5 BUILD-TIME ARTIFACT (.000Z)
    # ═══════════════════════════════════════════
    echo "  [06/12] L5 Build-Time Artifact (.000Z)..."
    
    ARTIFACT_COUNT=$(echo "$INDEX_CONTENT" | grep -c '\.000Z' 2>/dev/null || echo "0")
    
    if [ "$ARTIFACT_COUNT" -eq 0 ] 2>/dev/null; then
        add_result "$DOMAIN" "L5_BuildTime_Artifact" "PASS" ".000Z build-time artifact yok"
        echo "    ✅ PASS"
    else
        add_result "$DOMAIN" "L5_BuildTime_Artifact" "FAIL" "${ARTIFACT_COUNT} adet .000Z artifact bulundu"
        echo "    ❌ FAIL: ${ARTIFACT_COUNT} adet .000Z"
    fi

    # ═══════════════════════════════════════════
    # TEST 07: L6 LLMS.TXT EXISTENCE & SIZE
    # ═══════════════════════════════════════════
    echo "  [07/12] L6 llms.txt Varlık & İçerik..."
    
    LLMS_STATUS=$(curl -so /dev/null -w "%{http_code}" "https://${DOMAIN}/llms.txt" 2>/dev/null || echo "000")
    LLMS_SIZE=$(curl -s "https://${DOMAIN}/llms.txt" 2>/dev/null | wc -c | tr -d ' ' || echo "0")
    
    if [ "$LLMS_STATUS" = "200" ] && [ "$LLMS_SIZE" -gt 5000 ] 2>/dev/null; then
        add_result "$DOMAIN" "L6_LLMS_TXT" "PASS" "HTTP 200, ${LLMS_SIZE} karakter (>5000)"
        echo "    ✅ PASS: ${LLMS_SIZE} chars"
    elif [ "$LLMS_STATUS" = "200" ]; then
        add_result "$DOMAIN" "L6_LLMS_TXT" "WARN" "HTTP 200 ama içerik yetersiz: ${LLMS_SIZE} chars"
        echo "    ⚠️ WARN: ${LLMS_SIZE} chars (<5000)"
    else
        add_result "$DOMAIN" "L6_LLMS_TXT" "FAIL" "HTTP ${LLMS_STATUS}"
        echo "    ❌ FAIL: HTTP ${LLMS_STATUS}"
    fi

    # ═══════════════════════════════════════════
    # TEST 08: L6 ROBOTS.TXT LLMS REFERENCE
    # ═══════════════════════════════════════════
    echo "  [08/12] L6 robots.txt LLM Referansı..."
    
    ROBOTS_LLMS=$(curl -s "https://${DOMAIN}/robots.txt" 2>/dev/null | grep -ci "llms.txt" 2>/dev/null || echo "0")
    
    if [ "$ROBOTS_LLMS" -ge 1 ] 2>/dev/null; then
        add_result "$DOMAIN" "L6_Robots_LLMS_Ref" "PASS" "robots.txt içinde llms.txt referansı var"
        echo "    ✅ PASS"
    else
        add_result "$DOMAIN" "L6_Robots_LLMS_Ref" "FAIL" "robots.txt içinde llms.txt referansı yok"
        echo "    ❌ FAIL: Referans eksik"
    fi

    # ═══════════════════════════════════════════
    # TEST 09: §6 E-E-A-T DOM BLOCK
    # ═══════════════════════════════════════════
    echo "  [09/12] §6 E-E-A-T Trust Block DOM..."
    
    SAMPLE_PAGE=""
    case "$DOMAIN" in
        drfin.com.tr) SAMPLE_PAGE="/hesaplamalar/kobi-kredi-on-uygunluk" ;;
        isplani.com.tr) SAMPLE_PAGE="/sozluk/banka-dosyasi/banka-dosyasi-banka-basvurusu-icin-dosyada-hangi-bolumler-olmali-001" ;;
        cbamvalid.com) SAMPLE_PAGE="/sectors/cement" ;;
        sectorcalc.com) SAMPLE_PAGE="/calculators/oee" ;;
    esac
    
    if [ -n "$SAMPLE_PAGE" ]; then
        EEAT_HTML=$(curl -s "https://${DOMAIN}${SAMPLE_PAGE}" 2>/dev/null || true)
        HAS_AUTHOR=$(echo "$EEAT_HTML" | grep -ciE "Denetleyen|Author|Reviewed by|Barış Bağırlar|Neela Nataraj" 2>/dev/null || echo "0")
        HAS_DISCLAIMER=$(echo "$EEAT_HTML" | grep -ciE "Yasal Uyarı|Disclaimer|yatırım tavsiyesi değildir|not financial advice" 2>/dev/null || echo "0")
        HAS_CITATION=$(echo "$EEAT_HTML" | grep -ciE "BDDK|KOSGEB|TCMB|eur-lex|ISO|ECMI" 2>/dev/null || echo "0")
        
        if [ "$HAS_AUTHOR" -ge 1 ] 2>/dev/null && [ "$HAS_DISCLAIMER" -ge 1 ] 2>/dev/null && [ "$HAS_CITATION" -ge 1 ] 2>/dev/null; then
            add_result "$DOMAIN" "E-E-A-T_DOM_Block" "PASS" "Yazar+Disclaimer+Citation DOM'da mevcut"
            echo "    ✅ PASS"
        else
            add_result "$DOMAIN" "E-E-A-T_DOM_Block" "FAIL" "Author=${HAS_AUTHOR}, Disclaimer=${HAS_DISCLAIMER}, Citation=${HAS_CITATION}"
            echo "    ❌ FAIL: Author=${HAS_AUTHOR}, Discl=${HAS_DISCLAIMER}, Cit=${HAS_CITATION}"
        fi
    else
        add_result "$DOMAIN" "E-E-A-T_DOM_Block" "WARN" "Örnek sayfa belirlenemedi"
        echo "    ⚠️ WARN: Örnek sayfa yok"
    fi

    # ═══════════════════════════════════════════
    # TEST 10: §6 SCHEMA @GRAPH ENTITY CHAIN
    # ═══════════════════════════════════════════
    echo "  [10/12] §6 Schema @graph Entity Zinciri..."
    
    if [ -n "$SAMPLE_PAGE" ]; then
        GRAPH_JSON=$(echo "$EEAT_HTML" | grep -oE '<script type="application/ld\+json">[^<]+' | head -1 | sed 's/<script type="application\/ld+json">//' || true)
        
        if [ -n "$GRAPH_JSON" ]; then
            HAS_GRAPH=$(echo "$GRAPH_JSON" | grep -c '"@graph"' 2>/dev/null || echo "0")
            HAS_PERSON=$(echo "$GRAPH_JSON" | grep -c '"Person"' 2>/dev/null || echo "0")
            HAS_ORG=$(echo "$GRAPH_JSON" | grep -c '"Organization"' 2>/dev/null || echo "0")
            
            if [ "$HAS_GRAPH" -ge 1 ] 2>/dev/null && [ "$HAS_PERSON" -ge 1 ] 2>/dev/null && [ "$HAS_ORG" -ge 1 ] 2>/dev/null; then
                add_result "$DOMAIN" "Schema_Graph_Entity" "PASS" "@graph + Person + Organization mevcut"
                echo "    ✅ PASS"
            else
                add_result "$DOMAIN" "Schema_Graph_Entity" "FAIL" "@graph=${HAS_GRAPH}, Person=${HAS_PERSON}, Org=${HAS_ORG}"
                echo "    ❌ FAIL: @graph=${HAS_GRAPH}, Person=${HAS_PERSON}, Org=${HAS_ORG}"
            fi
        else
            add_result "$DOMAIN" "Schema_Graph_Entity" "FAIL" "JSON-LD script bulunamadı"
            echo "    ❌ FAIL: JSON-LD yok"
        fi
    else
        add_result "$DOMAIN" "Schema_Graph_Entity" "WARN" "Örnek sayfa belirlenemedi"
        echo "    ⚠️ WARN"
    fi

    # ═══════════════════════════════════════════
    # TEST 11: L4 TOXIC SITEMAP CHECK
    # ═══════════════════════════════════════════
    echo "  [11/12] L4 Toksik/Hayalet Sitemap İmha..."
    
    TOXIC_LIVE=0
    TOXIC_DETAILS=""
    TOXIC_FILES="sitemap-flat.xml sitemap-ai.xml business-ideas.xml business-plan.xml dictionary-categories.xml"
    
    for TF in $TOXIC_FILES; do
        TF_STATUS=$(curl -so /dev/null -w "%{http_code}" "https://${DOMAIN}/${TF}" 2>/dev/null || echo "000")
        if [ "$TF_STATUS" = "200" ] || [ "$TF_STATUS" = "301" ]; then
            TOXIC_LIVE=$((TOXIC_LIVE + 1))
            TOXIC_DETAILS="${TOXIC_DETAILS}${TF}=${TF_STATUS} "
        fi
    done
    
    if [ "$TOXIC_LIVE" -eq 0 ] 2>/dev/null; then
        add_result "$DOMAIN" "L4_Toxic_Sitemaps" "PASS" "Tüm toksik sitemap'ler 404/410"
        echo "    ✅ PASS"
    else
        add_result "$DOMAIN" "L4_Toxic_Sitemaps" "FAIL" "${TOXIC_LIVE} toksik dosya canlı: ${TOXIC_DETAILS}"
        echo "    ❌ FAIL: ${TOXIC_DETAILS}"
    fi

    # ═══════════════════════════════════════════
    # TEST 12: TRAILING SLASH CONSISTENCY
    # ═══════════════════════════════════════════
    echo "  [12/12] Trailing Slash Tutarlılığı..."
    
    SLASH_STATUS=$(curl -sI "https://${DOMAIN}/hesaplamalar/" 2>/dev/null | head -1 | extract_first '[0-9]{3}' || echo "000")
    NO_SLASH_STATUS=$(curl -sI "https://${DOMAIN}/hesaplamalar" 2>/dev/null | head -1 | extract_first '[0-9]{3}' || echo "000")
    
    if [ "$SLASH_STATUS" != "200" ] || [ "$NO_SLASH_STATUS" != "200" ]; then
        add_result "$DOMAIN" "Trailing_Slash" "PASS" "Çift 200 yok (Slash=${SLASH_STATUS}, NoSlash=${NO_SLASH_STATUS})"
        echo "    ✅ PASS"
    else
        add_result "$DOMAIN" "Trailing_Slash" "FAIL" "Her iki varyant da 200 dönüyor (duplicate content riski)"
        echo "    ❌ FAIL: Her ikisi de 200"
    fi

done

# ============================================================================
# FİNAL RAPOR OLUŞTURMA
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 FİNAL RAPOR OLUŞTURULUYOR..."

TOTAL_TESTS=$((PASS_COUNT + FAIL_COUNT + WARN_COUNT))
PASS_RATE=0
if [ "$TOTAL_TESTS" -gt 0 ] 2>/dev/null; then
    PASS_RATE=$((PASS_COUNT * 100 / TOTAL_TESTS))
fi

VERDICT="BLOCKED"
if [ "$FAIL_COUNT" -eq 0 ] 2>/dev/null; then
    VERDICT="PRODUCTION READY"
elif [ "$FAIL_COUNT" -le 3 ] 2>/dev/null; then
    VERDICT="CONDITIONAL GO"
fi

# JSON Rapor
cat > "$REPORT_FILE" << JSONEOF
{
  "report_version": "3.1-macos",
  "generated_at": "$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S')",
  "targets": ["drfin.com.tr", "isplani.com.tr", "cbamvalid.com", "sectorcalc.com"],
  "summary": {
    "total_tests": ${TOTAL_TESTS},
    "pass": ${PASS_COUNT},
    "fail": ${FAIL_COUNT},
    "warn": ${WARN_COUNT},
    "pass_rate": "${PASS_RATE}%",
    "verdict": "${VERDICT}"
  },
  "results": [${RESULTS}]
}
JSONEOF

# Konsol Özeti
echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   UNIVERSAL SEO STRES TESTİ v3.1 SONUÇ          ║"
echo "╠══════════════════════════════════════════════════╣"
printf "║  Toplam Test: %-34s ║\n" "$TOTAL_TESTS"
printf "║  ✅ PASS:     %-34s ║\n" "$PASS_COUNT"
printf "║  ❌ FAIL:     %-34s ║\n" "$FAIL_COUNT"
printf "║  ⚠️  WARN:     %-34s ║\n" "$WARN_COUNT"
printf "║  Başarı Oranı: %-33s ║\n" "${PASS_RATE}%"
echo "╠══════════════════════════════════════════════════╣"
printf "║  🏁 KARAR: %-38s ║\n" "$VERDICT"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "📄 Detaylı JSON Rapor: $REPORT_FILE"
echo ""

if [ "$VERDICT" = "BLOCKED" ]; then
    echo "🚫 DEPLOY KİLİDİ AÇIK. Kritik ihlaller giderilmeden production'a alınamaz."
    exit 1
elif [ "$VERDICT" = "CONDITIONAL GO" ]; then
    echo "⚠️  KOŞULLU ONAY. Minor ihlaller mevcut, düzeltme planı ile deploy edilebilir."
    exit 0
else
    echo "✅ ZERO-DEFECT TOLERANSINDA PRODUCTION READY. Deploy kilidi açık."
    exit 0
fi
