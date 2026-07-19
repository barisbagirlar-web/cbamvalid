#!/bin/bash
# ============================================================================
# CBAMVALID.COM — ÜST ÖNEM SEVİYESİ SEO TESTİ v2.0
# Clear-state, fresh-connection, no-cache, canonical-aware
# macOS Bash 3.2 safe
# ============================================================================

set -uo pipefail

# ─── CURL: fresh connection, no keepalive ───
CURL="curl --no-keepalive "

DOMAIN="cbamvalid.com"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="CbamValid_UST_ONEM_RAPOR_${TIMESTAMP}.json"

PASS_COUNT=0; FAIL_COUNT=0; WARN_COUNT=0; INFO_COUNT=0
RESULTS=""

add_result() {
    local test_name="$1" status="$2" detail="$3"
    local esc
    esc=$(printf '%s' "$detail" | sed 's/"/\\"/g; s/\n/ /g')
    if [ -n "$RESULTS" ]; then RESULTS="${RESULTS},"; fi
    RESULTS="${RESULTS}{\"test\":\"${test_name}\",\"status\":\"${status}\",\"detail\":\"${esc}\"}"
    case "$status" in
        PASS) PASS_COUNT=$((PASS_COUNT + 1)) ;;
        FAIL) FAIL_COUNT=$((FAIL_COUNT + 1)) ;;
        WARN) WARN_COUNT=$((WARN_COUNT + 1)) ;;
        INFO) INFO_COUNT=$((INFO_COUNT + 1)) ;;
    esac
}

extract_first() { grep -oE "$1" 2>/dev/null | head -1 || true; }

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   CBAMVALID.COM — ÜST ÖNEM SEVİYESİ SEO TESTİ v2.0         ║"
echo "║   Clear-State | Fresh DNS | No Cache | Canonical-Aware      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo "📅 Başlangıç: $(date '+%Y-%m-%dT%H:%M:%S%z')"
echo ""

# ═══════════════════════════════════════════════════════════════
# EVRE 0: DNS + CANONICAL DOMAIN TESPİTİ
# ═══════════════════════════════════════════════════════════════
echo "━━━ EVRE 0: DNS ÇÖZÜMLEME & CANONICAL TESPİT ━━━"

IP_ADDR=$(dig +short cbamvalid.com @1.1.1.1 2>/dev/null | head -1 || nslookup cbamvalid.com 2>/dev/null | grep "Address" | tail -1 | awk '{print $NF}')
echo "  DNS: ${IP_ADDR}"

# Canonical domain detection
NWW_RESP=$($CURL -sI "https://${DOMAIN}/" 2>/dev/null || true)
NWW_STATUS=$(echo "$NWW_RESP" | head -1 | extract_first '[0-9]{3}')
NWW_LOC=$(echo "$NWW_RESP" | grep -i "^location:" | head -1 | sed 's/.*: *//i' | tr -d '\r')

WWW_RESP=$($CURL -sI "https://www.${DOMAIN}/" 2>/dev/null || true)
WWW_STATUS=$(echo "$WWW_RESP" | head -1 | extract_first '[0-9]{3}')
WWW_LOC=$(echo "$WWW_RESP" | grep -i "^location:" | head -1 | sed 's/.*: *//i' | tr -d '\r')

echo "  non-www: ${NWW_STATUS}   www: ${WWW_STATUS}"

CANONICAL_URL=""
DUAL_200=0

if [ "$NWW_STATUS" = "200" ] && [ "$WWW_STATUS" = "200" ]; then
    echo "  ⚠️ İKİ VARYANT DA 200 → DUPLICATE CONTENT RİSKİ"
    DUAL_200=1
    CANONICAL_URL="https://${DOMAIN}"
elif [ "$NWW_STATUS" = "200" ]; then
    echo "  📍 Canonical: non-www (cbamvalid.com)"
    CANONICAL_URL="https://${DOMAIN}"
elif [ "$WWW_STATUS" = "200" ]; then
    echo "  📍 Canonical: www (www.cbamvalid.com)"
    CANONICAL_URL="https://www.${DOMAIN}"
else
    echo "  ❌ Hiçbir varyant 200 değil!"
    CANONICAL_URL="https://${DOMAIN}"
fi

echo "  🌐 Test URL'si: ${CANONICAL_URL}"
add_result "PRE_Canonical_Detection" "INFO" "Canonical=${CANONICAL_URL}, dual_200=${DUAL_200}"

# Site canlılık
STATUS_RESP=$($CURL -sI "${CANONICAL_URL}/" 2>/dev/null | head -1 || echo "000")
STATUS_CODE=$(echo "$STATUS_RESP" | extract_first '[0-9]{3}')
ALL_HEADERS=$($CURL -sI "${CANONICAL_URL}/" 2>/dev/null || true)

if [ "$STATUS_CODE" = "200" ]; then
    echo "  ✅ Site canlı (HTTP 200)"
    add_result "PRE_Site_Live" "PASS" "HTTP 200"
else
    echo "  ❌ Site canlı DEĞİL: HTTP ${STATUS_CODE}"
    add_result "PRE_Site_Live" "FAIL" "HTTP ${STATUS_CODE}"
fi

# Protocol
PROTO_VER=$(echo "$ALL_HEADERS" | head -1 | sed 's|HTTP/||' | awk '{print $1}')
echo "  Protokol: HTTP/${PROTO_VER}"

# TTFB
TTFB=$($CURL -s -o /dev/null -w "%{time_starttransfer}" "${CANONICAL_URL}/" 2>/dev/null || echo "0")
echo "  TTFB: ${TTFB}s"
add_result "PRE_TTFB" "INFO" "TTFB=${TTFB}s"

echo ""

# ═══════════════════════════════════════════════════════════════
# EVRE 1: PROTOKOL & YÖNLENDİRME
# ═══════════════════════════════════════════════════════════════
echo "━━━ EVRE 1: PROTOKOL & YÖNLENDİRME ━━━"

# 1a: HSTS
HSTS_LINE=$(echo "$ALL_HEADERS" | grep -i "^strict-transport-security:" | head -1 | tr -d '\r')
HSTS_HAS=$(echo "$ALL_HEADERS" | grep -ci "strict-transport-security" 2>/dev/null || echo "0")

if [ "$HSTS_HAS" -ge 1 ] 2>/dev/null; then
    echo "  [01] HSTS: ✅ ${HSTS_LINE}"
    add_result "L1_HSTS" "PASS" "${HSTS_LINE}"
else
    echo "  [01] HSTS: ❌ EKSİK"
    add_result "L1_HSTS" "FAIL" "HSTS header yok"
fi

# 1b: Diğer varyant yönlendirmesi
if [ "$DUAL_200" -eq 1 ] 2>/dev/null; then
    echo "  [02] Canonical Yönlendirme: ❌ Her iki varyant 200 (duplicate content!)"
    add_result "L1_Canonical_Redirect" "FAIL" "Dual 200 - duplicate content riski"
elif echo "$CANONICAL_URL" | grep -q "www"; then
    # Canonical www → non-www yönlenmeli
    if [ "$NWW_STATUS" = "301" ] || [ "$NWW_STATUS" = "308" ]; then
        echo "  [02] non-www→www: ✅ ${NWW_STATUS} -> ${NWW_LOC}"
        add_result "L1_Canonical_Redirect" "PASS" "non-www ${NWW_STATUS} -> www"
    else
        echo "  [02] non-www→www: ❌ ${NWW_STATUS} (301/308 bekleniyor)"
        add_result "L1_Canonical_Redirect" "FAIL" "non-www ${NWW_STATUS}"
    fi
else
    # Canonical non-www → www yönlenmeli
    if [ "$WWW_STATUS" = "301" ] || [ "$WWW_STATUS" = "308" ]; then
        echo "  [02] www→non-www: ✅ ${WWW_STATUS} -> ${WWW_LOC}"
        add_result "L1_Canonical_Redirect" "PASS" "www ${WWW_STATUS} -> non-www"
    else
        echo "  [02] www→non-www: ❌ ${WWW_STATUS} (301/308 bekleniyor)"
        add_result "L1_Canonical_Redirect" "FAIL" "www ${WWW_STATUS}"
    fi
fi

# 1c: HTTP → HTTPS
HTTP_RESP=$($CURL -sI "http://${DOMAIN}/" 2>/dev/null || true)
HTTP_ST=$(echo "$HTTP_RESP" | head -1 | extract_first '[0-9]{3}')
HTTP_LOC=$(echo "$HTTP_RESP" | grep -i "^location:" | head -1 | sed 's/.*: *//i' | tr -d '\r')

if [ "$HTTP_ST" = "301" ] || [ "$HTTP_ST" = "308" ]; then
    if echo "$HTTP_LOC" | grep -q "https"; then
        echo "  [03] HTTP→HTTPS: ✅ ${HTTP_ST}"
        add_result "L1_HTTP_HTTPS" "PASS" "HTTP ${HTTP_ST} -> HTTPS"
    else
        echo "  [03] HTTP→HTTPS: ❌ HTTPS hedef değil: ${HTTP_LOC}"
        add_result "L1_HTTP_HTTPS" "FAIL" "hedef: ${HTTP_LOC}"
    fi
else
    echo "  [03] HTTP→HTTPS: ⚠️ HTTP direkt ${HTTP_ST}"
    add_result "L1_HTTP_HTTPS" "WARN" "HTTP ${HTTP_ST}"
fi

echo ""

# ═══════════════════════════════════════════════════════════════
# EVRE 2: SITEMAP ALTYAPISI
# ═══════════════════════════════════════════════════════════════
echo "━━━ EVRE 2: SITEMAP ALTYAPISI ━━━"

# 2a: Status & Content-Type
SM_HEADERS=$($CURL -sI "${CANONICAL_URL}/sitemap.xml" 2>/dev/null || true)
SM_STATUS=$(echo "$SM_HEADERS" | head -1 | extract_first '[0-9]{3}')
SM_CT=$(echo "$SM_HEADERS" | grep -i "^content-type:" | head -1 | tr -d '\r')

echo "  [04] /sitemap.xml: HTTP ${SM_STATUS}"

if [ "$SM_STATUS" = "200" ]; then
    if echo "$SM_CT" | grep -qi "application/xml"; then
        echo "  [05] Content-Type: ✅ ${SM_CT}"
        add_result "L2_ContentType" "PASS" "${SM_CT}"
    else
        echo "  [05] Content-Type: ❌ ${SM_CT}"
        add_result "L2_ContentType" "FAIL" "${SM_CT}"
    fi
elif [ "$SM_STATUS" = "301" ] || [ "$SM_STATUS" = "308" ]; then
    SM_REDIR=$(echo "$SM_HEADERS" | grep -i "^location:" | head -1 | sed 's/.*: *//i' | tr -d '\r')
    echo "  [05] Sitemap Yönleniyor: ${SM_STATUS} -> ${SM_REDIR}"
    add_result "L2_ContentType" "FAIL" "Redirect ${SM_STATUS} -> ${SM_REDIR}"
fi

# 2b: XML içeriği (redirect varsa -L ile takip et)
SM_CONTENT=$($CURL -sL "${CANONICAL_URL}/sitemap.xml" 2>/dev/null || true)
SM_FIRST=$(echo "$SM_CONTENT" | head -1 | cut -c1-100)
HAS_XML=$(echo "$SM_FIRST" | grep -c '<?xml' 2>/dev/null || echo "0")
HAS_INDEX=$(echo "$SM_CONTENT" | grep -c '<sitemapindex' 2>/dev/null || echo "0")

if [ "$HAS_XML" -ge 1 ] 2>/dev/null && [ "$HAS_INDEX" -ge 1 ] 2>/dev/null; then
    echo "  [06] XML Zarf: ✅ sitemapindex yapısı"
    add_result "L2_XML_Envelope" "PASS" "XML decl + sitemapindex mevcut"
else
    echo "  [06] XML Zarf: ❌ İlk satır: ${SM_FIRST}"
    add_result "L2_XML_Envelope" "FAIL" "Ilk satir: ${SM_FIRST}"
fi

# 2c: Alt sitemap listesi
SUB_SITEMAPS=$(echo "$SM_CONTENT" | extract_first '<loc>[^<]+</loc>' | sed 's/<[^>]*>//g' || true)
SM_COUNT=$(echo "$SUB_SITEMAPS" | grep -c "http" 2>/dev/null || echo "0")
echo "  [07] Alt Sitemap: ${SM_COUNT} adet"

ALL_URLS_TMP=$(mktemp)
TOTAL_URLS=0
URL_ERRORS=0

if [ -n "$SUB_SITEMAPS" ] && [ "$SM_COUNT" -gt 0 ] 2>/dev/null; then
    for SM in $SUB_SITEMAPS; do
        SM_HTTP=$($CURL -s -o /dev/null -w "%{http_code}" "$SM" 2>/dev/null || echo "000")
        if [ "$SM_HTTP" = "200" ]; then
            $CURL -s "$SM" 2>/dev/null | extract_first '<loc>[^<]+</loc>' | sed 's/<[^>]*>//g' >> "$ALL_URLS_TMP" 2>/dev/null || true
        else
            URL_ERRORS=$((URL_ERRORS + 1))
        fi
    done
    TOTAL_URLS=$(wc -l < "$ALL_URLS_TMP" | tr -d ' ' || echo "0")
fi

echo "  [08] Toplam URL: ${TOTAL_URLS} (hatalı alt sitemap: ${URL_ERRORS})"
add_result "L2_Total_URLs" "INFO" "${TOTAL_URLS} URL, ${SM_COUNT} alt sitemap"

# Alt sitemap dağılımı
SM_IDX=0
for SM in $SUB_SITEMAPS; do
    SM_IDX=$((SM_IDX + 1))
    SM_URL_CNT=$($CURL -s "$SM" 2>/dev/null | grep -c '<loc>' 2>/dev/null || echo "0")
    SM_NAME=$(echo "$SM" | sed 's|.*/||')
    echo "      ${SM_IDX}. ${SM_NAME}: ${SM_URL_CNT} URL"
done

echo ""

# ═══════════════════════════════════════════════════════════════
# EVRE 3: DUPLICATE & TOXIC
# ═══════════════════════════════════════════════════════════════
echo "━━━ EVRE 3: DUPLICATE & TOXIC KONTROL ━━━"

# 3a: Duplicate URL
if [ "$TOTAL_URLS" -gt 0 ] 2>/dev/null; then
    DUP_CNT=$(sort "$ALL_URLS_TMP" 2>/dev/null | uniq -d | wc -l | tr -d ' ' || echo "0")
    if [ "$DUP_CNT" -eq 0 ] 2>/dev/null; then
        echo "  [09] Duplicate URL: ✅ Yok"
        add_result "L3_Duplicate_URLs" "PASS" "Duplicate yok"
    else
        DUP_LIST=$(sort "$ALL_URLS_TMP" 2>/dev/null | uniq -d | head -3 | tr '\n' ' ')
        echo "  [09] Duplicate URL: ❌ ${DUP_CNT} adet: ${DUP_LIST}"
        add_result "L3_Duplicate_URLs" "FAIL" "${DUP_CNT} adet: ${DUP_LIST}"
    fi
else
    echo "  [09] Duplicate URL: ⚠️ Veri alınamadı"
    add_result "L3_Duplicate_URLs" "WARN" "Veri yok"
fi

# 3b: Toxic sitemap
TOXIC_FILES="sitemap-flat.xml sitemap-ai.xml business-ideas.xml business-plan.xml dictionary-categories.xml sitemap-0.xml sitemap-index.xml sitemap_dynamic.xml"
TOXIC_LIVE=0
TOXIC_DETAILS=""

for TF in $TOXIC_FILES; do
    TF_STATUS=$($CURL -s -o /dev/null -w "%{http_code}" "${CANONICAL_URL}/${TF}" 2>/dev/null || echo "000")
    if [ "$TF_STATUS" = "200" ] || [ "$TF_STATUS" = "301" ]; then
        TOXIC_LIVE=$((TOXIC_LIVE + 1))
        TOXIC_DETAILS="${TOXIC_DETAILS}${TF}=${TF_STATUS} "
    fi
done

if [ "$TOXIC_LIVE" -eq 0 ] 2>/dev/null; then
    echo "  [10] Toksik Sitemap: ✅ Hepsi temiz"
    add_result "L3_Toxic_Sitemaps" "PASS" "Tüm toksik dosyalar ölü"
else
    echo "  [10] Toksik Sitemap: ❌ ${TOXIC_LIVE} canlı: ${TOXIC_DETAILS}"
    add_result "L3_Toxic_Sitemaps" "FAIL" "${TOXIC_LIVE} canlı: ${TOXIC_DETAILS}"
fi

rm -f "$ALL_URLS_TMP"

echo ""

# ═══════════════════════════════════════════════════════════════
# EVRE 4: LASTMOD & ARTIFACTS
# ═══════════════════════════════════════════════════════════════
echo "━━━ EVRE 4: LASTMOD & BUILD-TIME ARTIFACTS ━━━"

# 4a: Lastmod monokültür
INDEX_DATES=$(echo "$SM_CONTENT" | grep -oE '<lastmod>[^<]+</lastmod>' | sed 's/<[^>]*>//g' || true)

if [ -n "$INDEX_DATES" ]; then
    TOTAL_DATES=$(echo "$INDEX_DATES" | wc -l | tr -d ' ')
    MAX_REPEAT=$(echo "$INDEX_DATES" | sort | uniq -c | sort -rn | head -1 | awk '{print $1}')
    UNIQ_DATES=$(echo "$INDEX_DATES" | sort -u | wc -l | tr -d ' ')
    
    if [ "$TOTAL_DATES" -gt 0 ] 2>/dev/null; then
        RATIO=$((MAX_REPEAT * 100 / TOTAL_DATES))
        echo "  [11] Lastmod: ${TOTAL_DATES} adet, ${UNIQ_DATES} benzersiz"
        
        if [ "$RATIO" -lt 50 ] 2>/dev/null; then
            echo "  [12] Monokültür: ✅ %${RATIO} (<%50)"
            add_result "L4_Lastmod_Monoculture" "PASS" "%${RATIO} monokultur"
        elif [ "$RATIO" -lt 80 ] 2>/dev/null; then
            echo "  [12] Monokültür: ⚠️ %${RATIO} (50-79%)"
            add_result "L4_Lastmod_Monoculture" "WARN" "%${RATIO} monokultur"
        elif [ "$RATIO" -ge 100 ] 2>/dev/null; then
            echo "  [12] Monokültür: ❌ TAM MONOKÜLTÜR (%100)"
            add_result "L4_Lastmod_Monoculture" "FAIL" "TAM MONOKULTUR %100"
        else
            echo "  [12] Monokültür: ❌ %${RATIO} (>=%80)"
            add_result "L4_Lastmod_Monoculture" "FAIL" "%${RATIO} monokultur"
        fi
    fi
else
    echo "  [11-12] Lastmod: ❌ Hiç lastmod elementi yok"
    add_result "L4_Lastmod_Monoculture" "FAIL" "Lastmod yok"
fi

# 4b: .000Z artifact (DÜZGÜN SAYIM)
Z_COUNT=$(echo "$SM_CONTENT" | grep -c '\.000Z' 2>/dev/null || true)
Z_COUNT=$(echo "$Z_COUNT" | tr -d ' \n')
if [ -z "$Z_COUNT" ]; then Z_COUNT=0; fi

if [ "$Z_COUNT" -eq 0 ] 2>/dev/null; then
    echo "  [13] .000Z Artifact: ✅ Yok"
    add_result "L4_BuildTime_Artifact" "PASS" "0 adet .000Z"
else
    echo "  [13] .000Z Artifact: ❌ ${Z_COUNT} adet"
    add_result "L4_BuildTime_Artifact" "FAIL" "${Z_COUNT} adet .000Z"
fi

# 4c: Alt sitemap .000Z taraması
TOTAL_Z=0
if [ "$SM_COUNT" -gt 0 ] 2>/dev/null; then
    for SM in $SUB_SITEMAPS; do
        SM_Z=$($CURL -s "$SM" 2>/dev/null | grep -c '\.000Z' 2>/dev/null || echo "0")
        SM_Z=$(echo "$SM_Z" | tr -d ' \n')
        if [ -z "$SM_Z" ]; then SM_Z=0; fi
        if [ "$SM_Z" -gt 0 ] 2>/dev/null; then
            TOTAL_Z=$((TOTAL_Z + SM_Z))
        fi
    done
fi

if [ "$TOTAL_Z" -gt 0 ] 2>/dev/null; then
    echo "  [14] Alt Sitemap .000Z: ❌ ${TOTAL_Z} adet"
    add_result "L4_Sub_Artifacts" "FAIL" "${TOTAL_Z} adet alt sitemap .000Z"
else
    echo "  [14] Alt Sitemap .000Z: ✅ Temiz"
    add_result "L4_Sub_Artifacts" "PASS" "Alt sitemap'ler temiz"
fi

echo ""

# ═══════════════════════════════════════════════════════════════
# EVRE 5: LLMS.TXT & ROBOTS.TXT
# ═══════════════════════════════════════════════════════════════
echo "━━━ EVRE 5: LLMS.TXT & ROBOTS.TXT ━━━"

# 5a: llms.txt
LLMS_BODY=$($CURL -sL "${CANONICAL_URL}/llms.txt" 2>/dev/null || true)
LLMS_STATUS=$($CURL -sL -o /dev/null -w "%{http_code}" "${CANONICAL_URL}/llms.txt" 2>/dev/null || echo "000")
LLMS_SIZE=$(echo "$LLMS_BODY" | wc -c | tr -d ' ')
LLMS_LINES=$(echo "$LLMS_BODY" | wc -l | tr -d ' ')

echo "  [15] llms.txt: HTTP ${LLMS_STATUS}, ${LLMS_SIZE} byte, ${LLMS_LINES} satır"

if [ "$LLMS_STATUS" = "200" ]; then
    if [ "$LLMS_SIZE" -gt 10000 ] 2>/dev/null; then
        echo "  [16] llms.txt Boyut: ✅ ${LLMS_SIZE} byte (>10K - mükemmel)"
        add_result "L5_LLMS_TXT" "PASS" "HTTP 200, ${LLMS_SIZE} byte"
    elif [ "$LLMS_SIZE" -gt 5000 ] 2>/dev/null; then
        echo "  [16] llms.txt Boyut: ✅ ${LLMS_SIZE} byte (>5K - yeterli)"
        add_result "L5_LLMS_TXT" "PASS" "HTTP 200, ${LLMS_SIZE} byte"
    elif [ "$LLMS_SIZE" -gt 0 ] 2>/dev/null; then
        echo "  [16] llms.txt Boyut: ⚠️ ${LLMS_SIZE} byte (<5K - yetersiz)"
        add_result "L5_LLMS_TXT" "WARN" "HTTP 200, ${LLMS_SIZE} byte (<5K)"
    else
        echo "  [16] llms.txt Boyut: ❌ Boş"
        add_result "L5_LLMS_TXT" "FAIL" "HTTP 200 ama boş"
    fi
else
    echo "  [16] llms.txt: ❌ HTTP ${LLMS_STATUS}"
    add_result "L5_LLMS_TXT" "FAIL" "HTTP ${LLMS_STATUS}"
fi

# 5b: llms-full.txt
LLMSF_BODY=$($CURL -sL "${CANONICAL_URL}/llms-full.txt" 2>/dev/null || true)
LLMSF_STATUS=$($CURL -sL -o /dev/null -w "%{http_code}" "${CANONICAL_URL}/llms-full.txt" 2>/dev/null || echo "000")
LLMSF_SIZE=$(echo "$LLMSF_BODY" | wc -c | tr -d ' ')

if [ "$LLMSF_STATUS" = "200" ]; then
    echo "  [17] llms-full.txt: ✅ HTTP 200, ${LLMSF_SIZE} byte"
    add_result "L5_LLMS_FULL_TXT" "PASS" "HTTP 200, ${LLMSF_SIZE} byte"
else
    echo "  [17] llms-full.txt: ⚠️ HTTP ${LLMSF_STATUS}"
    add_result "L5_LLMS_FULL_TXT" "WARN" "HTTP ${LLMSF_STATUS}"
fi

# 5c: robots.txt
ROBOTS_BODY=$($CURL -sL "${CANONICAL_URL}/robots.txt" 2>/dev/null || true)
ROBOTS_STATUS=$($CURL -sL -o /dev/null -w "%{http_code}" "${CANONICAL_URL}/robots.txt" 2>/dev/null || echo "000")
ROBOTS_LLMS=$(echo "$ROBOTS_BODY" | grep -ci "llms.txt" 2>/dev/null || echo "0")
ROBOTS_LLMSF=$(echo "$ROBOTS_BODY" | grep -ci "llms-full.txt" 2>/dev/null || echo "0")
ROBOTS_LINES=$(echo "$ROBOTS_BODY" | wc -l | tr -d ' ')

echo "  [18] robots.txt: HTTP ${ROBOTS_STATUS}, ${ROBOTS_LINES} satır, llms.txt=${ROBOTS_LLMS}, llms-full.txt=${ROBOTS_LLMSF}"

if [ "$ROBOTS_LLMS" -ge 1 ] 2>/dev/null; then
    echo "  [19] robots.txt LLM Ref: ✅ llms.txt referansı var"
    add_result "L5_Robots_LLMS_Ref" "PASS" "llms.txt referansı var"
else
    echo "  [19] robots.txt LLM Ref: ❌ llms.txt referansı yok"
    add_result "L5_Robots_LLMS_Ref" "FAIL" "llms.txt referansı yok"
fi

echo ""

# ═══════════════════════════════════════════════════════════════
# EVRE 6: SAYFA İÇİ SEO
# ═══════════════════════════════════════════════════════════════
echo "━━━ EVRE 6: SAYFA İÇİ SEO (ANA SAYFA + SEKTÖR) ━━━"

# 6a: Ana sayfa
HOME_HTML=$($CURL -sL "${CANONICAL_URL}/" 2>/dev/null || true)
HOME_SIZE=$(echo "$HOME_HTML" | wc -c | tr -d ' ')

# Title
HOME_TITLE=$(echo "$HOME_HTML" | grep -oE '<title>[^<]*</title>' | head -1 | sed 's/<[^>]*>//g')
TITLE_LEN=$(echo "$HOME_TITLE" | wc -c | tr -d ' ')

if [ -n "$HOME_TITLE" ]; then
    echo "  [20] Title: ✅ '${HOME_TITLE}' (${TITLE_LEN} karakter)"
    add_result "L6_Title" "PASS" "${TITLE_LEN} karakter"
else
    echo "  [20] Title: ❌ YOK"
    add_result "L6_Title" "FAIL" "Title yok"
fi

# Meta Description
HOME_DESC=$(echo "$HOME_HTML" | grep -oE '<meta[^>]*name="description"[^>]*content="[^"]*"[^>]*>' | head -1 | sed 's/.*content="\([^"]*\)".*/\1/' || echo "")
HOME_DESC_OG=$(echo "$HOME_HTML" | grep -oE '<meta[^>]*property="og:description"[^>]*content="[^"]*"[^>]*>' | head -1 | sed 's/.*content="\([^"]*\)".*/\1/' || echo "")

if [ -n "$HOME_DESC" ]; then
    DESC_LEN=$(echo "$HOME_DESC" | wc -c | tr -d ' ')
    echo "  [21] Meta Description: ✅ ${DESC_LEN} karakter"
    add_result "L6_Meta_Desc" "PASS" "${DESC_LEN} karakter"
elif [ -n "$HOME_DESC_OG" ]; then
    echo "  [21] Meta Description: ⚠️ Sadece OG description var"
    add_result "L6_Meta_Desc" "WARN" "Sadece OG description"
else
    echo "  [21] Meta Description: ❌ Yok"
    add_result "L6_Meta_Desc" "FAIL" "Meta description yok"
fi

# Canonical Tag
HOME_CANONICAL=$(echo "$HOME_HTML" | grep -oE '<link[^>]*rel="canonical"[^>]*href="[^"]*"[^>]*>' | head -1 | sed 's/.*href="\([^"]*\)".*/\1/' || echo "")
echo "  [22] Canonical: $([ -n "$HOME_CANONICAL" ] && echo "✅ ${HOME_CANONICAL}" || echo "❌ Yok")"
if [ -n "$HOME_CANONICAL" ]; then
    add_result "L6_Canonical_Tag" "PASS" "${HOME_CANONICAL}"
else
    add_result "L6_Canonical_Tag" "WARN" "Canonical tag yok"
fi

# OpenGraph
OG_TITLE=$(echo "$HOME_HTML" | grep -oE '<meta[^>]*property="og:title"[^>]*content="[^"]*"[^>]*>' | head -1 | sed 's/.*content="\([^"]*\)".*/\1/' || echo "")
OG_DESC=$(echo "$HOME_HTML" | grep -oE '<meta[^>]*property="og:description"[^>]*content="[^"]*"[^>]*>' | head -1 | sed 's/.*content="\([^"]*\)".*/\1/' || echo "")
OG_IMAGE=$(echo "$HOME_HTML" | grep -oE '<meta[^>]*property="og:image"[^>]*content="[^"]*"[^>]*>' | head -1 | sed 's/.*content="\([^"]*\)".*/\1/' || echo "")

OG_OK=0
[ -n "$OG_TITLE" ] && OG_OK=$((OG_OK + 1))
[ -n "$OG_DESC" ] && OG_OK=$((OG_OK + 1))
[ -n "$OG_IMAGE" ] && OG_OK=$((OG_OK + 1))

echo "  [23] OpenGraph: Title=$([ -n "$OG_TITLE" ] && echo "✅" || echo "❌") Desc=$([ -n "$OG_DESC" ] && echo "✅" || echo "❌") Image=$([ -n "$OG_IMAGE" ] && echo "✅" || echo "❌")"
if [ "$OG_OK" -eq 3 ] 2>/dev/null; then
    add_result "L6_OpenGraph" "PASS" "3/3 OG tag'i mevcut"
else
    add_result "L6_OpenGraph" "WARN" "${OG_OK}/3 OG tag'i mevcut"
fi

# Viewport & Mobile
HAS_VIEWPORT=$(echo "$HOME_HTML" | grep -c 'viewport' 2>/dev/null || echo "0")
echo "  [24] Mobile Viewport: $([ "$HAS_VIEWPORT" -ge 1 ] 2>/dev/null && echo "✅ Var" || echo "❌ Yok")"
if [ "$HAS_VIEWPORT" -ge 1 ] 2>/dev/null; then
    add_result "L6_Viewport" "PASS" "Viewport meta tag mevcut"
else
    add_result "L6_Viewport" "FAIL" "Viewport meta tag yok"
fi

# Sayfa boyutu/yükleme
PAGE_SIZE=$($CURL -s -o /dev/null -w "%{size_download}" "${CANONICAL_URL}/" 2>/dev/null || echo "0")
PAGE_TIME=$($CURL -s -o /dev/null -w "%{time_total}" "${CANONICAL_URL}/" 2>/dev/null || echo "0")
echo "  [25] Sayfa: ${PAGE_SIZE} byte, Yükleme: ${PAGE_TIME}s"
add_result "L6_Page_Perf" "INFO" "HTML=${PAGE_SIZE}B, load=${PAGE_TIME}s"

# 6b: Sektör sayfaları canlılık kontrolü
SECTORS="cement aluminium fertilisers iron-steel hydrogen electricity"
SECT_OK=0
SECT_FAIL=0

for SECTOR in $SECTORS; do
    SECT_TITLE=$($CURL -sL "${CANONICAL_URL}/sectors/${SECTOR}" 2>/dev/null | grep -oE '<title>[^<]+</title>' | head -1 | sed 's/<[^>]*>//g' || echo "")
    SECT_ST=$($CURL -sL -o /dev/null -w "%{http_code}" "${CANONICAL_URL}/sectors/${SECTOR}" 2>/dev/null || echo "000")
    
    if [ "$SECT_ST" = "200" ] && [ -n "$SECT_TITLE" ]; then
        SECT_OK=$((SECT_OK + 1))
    else
        SECT_FAIL=$((SECT_FAIL + 1))
    fi
done

SECTOR_COUNT=$(echo "$SECTORS" | wc -w | tr -d ' ')
echo "  [26] Sektör Sayfaları: ${SECT_OK}/${SECTOR_COUNT} canlı"

# E-E-A-T DOM (cement sayfası)
CEMENT_HTML=$($CURL -sL "${CANONICAL_URL}/sectors/cement" 2>/dev/null || true)
AUTHOR=$(echo "$CEMENT_HTML" | grep -ciE "Denetleyen|Author|Reviewed by|Barış Bağırlar|Neela Nataraj" 2>/dev/null || echo "0")
DISC=$(echo "$CEMENT_HTML" | grep -ciE "Yasal Uyarı|Disclaimer|yatırım tavsiyesi değildir|not financial advice|bilgilendirme amaçlıdır" 2>/dev/null || echo "0")
CIT=$(echo "$CEMENT_HTML" | grep -ciE "BDDK|KOSGEB|TCMB|eur-lex|ISO|ECMI|Official Journal|Regulation" 2>/dev/null || echo "0")

echo "  [27] E-E-A-T (cement): Author=${AUTHOR}, Disc=${DISC}, Cit=${CIT}"

if [ "$AUTHOR" -ge 1 ] 2>/dev/null && [ "$DISC" -ge 1 ] 2>/dev/null && [ "$CIT" -ge 1 ] 2>/dev/null; then
    echo "  [28] E-E-A-T: ✅ Tüm bloklar mevcut"
    add_result "L6_E-E-A-T" "PASS" "Author+Disclaimer+Citation var"
elif [ "$AUTHOR" -ge 1 ] 2>/dev/null || [ "$DISC" -ge 1 ] 2>/dev/null || [ "$CIT" -ge 1 ] 2>/dev/null; then
    echo "  [28] E-E-A-T: ⚠️ Kısmi (A=${AUTHOR},D=${DISC},C=${CIT})"
    add_result "L6_E-E-A-T" "WARN" "Kismi: A=${AUTHOR},D=${DISC},C=${CIT}"
else
    echo "  [28] E-E-A-T: ❌ Hiçbiri yok"
    add_result "L6_E-E-A-T" "FAIL" "Hicbiri yok"
fi

# 6c: Schema @graph
GRAPH_JSON=$(echo "$CEMENT_HTML" | grep -oE '<script type="application/ld\+json">[^<]+' | head -1 | sed 's/<script type="application\/ld+json">//' || true)

if [ -n "$GRAPH_JSON" ]; then
    HAS_GRAPH=$(echo "$GRAPH_JSON" | grep -c '"@graph"' 2>/dev/null || echo "0")
    HAS_PERSON=$(echo "$GRAPH_JSON" | grep -c '"Person"' 2>/dev/null || echo "0")
    HAS_ORG=$(echo "$GRAPH_JSON" | grep -c '"Organization"' 2>/dev/null || echo "0")
    HAS_WP=$(echo "$GRAPH_JSON" | grep -c '"WebPage"' 2>/dev/null || echo "0")
    HAS_BC=$(echo "$GRAPH_JSON" | grep -c '"BreadcrumbList"' 2>/dev/null || echo "0")
    
    echo "  [29] Schema: @graph=${HAS_GRAPH} Person=${HAS_PERSON} Org=${HAS_ORG} WebPage=${HAS_WP} Breadcrumb=${HAS_BC}"
    
    if [ "$HAS_GRAPH" -ge 1 ] 2>/dev/null && [ "$HAS_PERSON" -ge 1 ] 2>/dev/null && [ "$HAS_ORG" -ge 1 ] 2>/dev/null; then
        echo "  [30] Schema Zincir: ✅ Tam entity zinciri"
        add_result "L6_Schema_Graph" "PASS" "@graph+Person+Org+WP+BC"
    elif [ "$HAS_GRAPH" -ge 1 ] 2>/dev/null; then
        echo "  [30] Schema Zincir: ⚠️ @graph var ama Person/Org eksik"
        add_result "L6_Schema_Graph" "WARN" "@graph var, eksik entity"
    else
        echo "  [30] Schema Zincir: ❌ @graph yok"
        add_result "L6_Schema_Graph" "FAIL" "@graph yok"
    fi
else
    echo "  [29-30] Schema: ❌ JSON-LD bulunamadı"
    add_result "L6_Schema_Graph" "FAIL" "JSON-LD yok"
fi

# Heading hiyerarşisi
H1=$(echo "$CEMENT_HTML" | grep -ci '<h1' 2>/dev/null || echo "0")
H2=$(echo "$CEMENT_HTML" | grep -ci '<h2' 2>/dev/null || echo "0")
H3=$(echo "$CEMENT_HTML" | grep -ci '<h3' 2>/dev/null || echo "0")
echo "  [31] Heading: H1=${H1}, H2=${H2}, H3=${H3}"
if [ "$H1" -eq 1 ] 2>/dev/null; then
    add_result "L6_Heading" "PASS" "H1=1, H2=${H2}, H3=${H3}"
else
    add_result "L6_Heading" "WARN" "H1=${H1} (1 olmalı)"
fi

echo ""

# ═══════════════════════════════════════════════════════════════
# EVRE 7: GÜVENLİK BAŞLIKLARI
# ═══════════════════════════════════════════════════════════════
echo "━━━ EVRE 7: GÜVENLİK BAŞLIKLARI ━━━"

# CSP
if echo "$ALL_HEADERS" | grep -qi "content-security-policy"; then
    echo "  [32] CSP: ✅ Mevcut"
    add_result "L7_CSP" "PASS" "Content-Security-Policy var"
else
    echo "  [32] CSP: ⚠️ Yok"
    add_result "L7_CSP" "WARN" "CSP yok"
fi

# X-Frame-Options
if echo "$ALL_HEADERS" | grep -qi "x-frame-options"; then
    XFO=$(echo "$ALL_HEADERS" | grep -i "x-frame-options" | sed 's/.*: *//i' | tr -d '\r')
    echo "  [33] X-Frame-Options: ✅ ${XFO}"
    add_result "L7_X_Frame" "PASS" "${XFO}"
else
    echo "  [33] X-Frame-Options: ❌ Yok"
    add_result "L7_X_Frame" "FAIL" "X-Frame-Options yok"
fi

# X-Content-Type-Options
if echo "$ALL_HEADERS" | grep -qi "x-content-type-options"; then
    echo "  [34] X-Content-Type-Options: ✅ Mevcut"
    add_result "L7_X_CTO" "PASS" "X-Content-Type-Options var"
else
    echo "  [34] X-Content-Type-Options: ❌ Yok"
    add_result "L7_X_CTO" "FAIL" "X-Content-Type-Options yok"
fi

# Referrer-Policy
if echo "$ALL_HEADERS" | grep -qi "referrer-policy"; then
    RP=$(echo "$ALL_HEADERS" | grep -i "referrer-policy" | head -1 | sed 's/.*: *//i' | tr -d '\r')
    echo "  [35] Referrer-Policy: ✅ ${RP}"
    add_result "L7_ReferrerPolicy" "PASS" "${RP}"
else
    echo "  [35] Referrer-Policy: ⚠️ Yok"
    add_result "L7_ReferrerPolicy" "WARN" "Referrer-Policy yok"
fi

# Compression
if echo "$ALL_HEADERS" | grep -qi "content-encoding:"; then
    CE=$(echo "$ALL_HEADERS" | grep -i "content-encoding:" | head -1 | sed 's/.*: *//i' | tr -d '\r')
    echo "  [36] Sıkıştırma: ✅ ${CE}"
    add_result "L7_Compression" "PASS" "${CE}"
else
    echo "  [36] Sıkıştırma: ⚠️ Yok"
    add_result "L7_Compression" "WARN" "Content-Encoding yok"
fi

# Cache-Control
if echo "$ALL_HEADERS" | grep -qi "cache-control:"; then
    CC=$(echo "$ALL_HEADERS" | grep -i "cache-control:" | head -1 | sed 's/.*: *//i' | tr -d '\r')
    echo "  [37] Cache-Control: ℹ️ ${CC}"
    add_result "L7_CacheControl" "INFO" "${CC}"
else
    echo "  [37] Cache-Control: ⚠️ Yok"
    add_result "L7_CacheControl" "WARN" "Cache-Control yok"
fi

echo ""

# ═══════════════════════════════════════════════════════════════
# EVRE 8: TRAILING SLASH & 404
# ═══════════════════════════════════════════════════════════════
echo "━━━ EVRE 8: TRAILING SLASH & 404 ━━━"

SEC_SLASH=$($CURL -sI "${CANONICAL_URL}/sectors/cement/" 2>/dev/null | head -1 | extract_first '[0-9]{3}')
SEC_NOSLASH=$($CURL -sI "${CANONICAL_URL}/sectors/cement" 2>/dev/null | head -1 | extract_first '[0-9]{3}')

echo "  [38] /sectors/cement/: ${SEC_SLASH}"
echo "  [39] /sectors/cement : ${SEC_NOSLASH}"

if [ "$SEC_SLASH" = "200" ] && [ "$SEC_NOSLASH" = "200" ]; then
    echo "  [40] Trailing Slash: ❌ ÇİFT 200 — duplicate content riski"
    add_result "L8_Trailing_Slash" "FAIL" "İki varyant da 200"
elif [ "$SEC_SLASH" = "301" ] || [ "$SEC_SLASH" = "308" ] || [ "$SEC_NOSLASH" = "301" ] || [ "$SEC_NOSLASH" = "308" ]; then
    echo "  [40] Trailing Slash: ✅ Yönlendirme var"
    add_result "L8_Trailing_Slash" "PASS" "Yonlendirme mevcut (/=${SEC_SLASH}, no/=${SEC_NOSLASH})"
else
    echo "  [40] Trailing Slash: ✅ Çift 200 yok (/=${SEC_SLASH}, no/=${SEC_NOSLASH})"
    add_result "L8_Trailing_Slash" "PASS" "/=${SEC_SLASH}, no/=${SEC_NOSLASH}"
fi

# 404 sayfası
NF_HTML=$($CURL -sL "${CANONICAL_URL}/bu-sayfa-yok-404-test" 2>/dev/null || true)
NF_STATUS=$($CURL -sL -o /dev/null -w "%{http_code}" "${CANONICAL_URL}/bu-sayfa-yok-404-test" 2>/dev/null || echo "000")
NF_SIZE=$(echo "$NF_HTML" | wc -c | tr -d ' ')
NF_TITLE=$(echo "$NF_HTML" | grep -oE '<title>[^<]+</title>' | head -1 | sed 's/<[^>]*>//g' || echo "")

echo "  [41] 404 Sayfası: HTTP ${NF_STATUS}, Boyut=${NF_SIZE}B"

if [ "$NF_STATUS" = "404" ]; then
    if [ "$NF_SIZE" -gt 500 ] 2>/dev/null; then
        echo "  [42] 404: ✅ Özgün 404 sayfası (Title: '${NF_TITLE}')"
        add_result "L8_404" "PASS" "Ozgun 404 (${NF_SIZE}B)"
    else
        echo "  [42] 404: ⚠️ Küçük içerik (${NF_SIZE}B)"
        add_result "L8_404" "WARN" "Kucuk 404 (${NF_SIZE}B)"
    fi
else
    echo "  [42] 404: ❌ HTTP ${NF_STATUS} (404 bekleniyor)"
    add_result "L8_404" "FAIL" "HTTP ${NF_STATUS}"
fi

echo ""

# ═══════════════════════════════════════════════════════════════
# EVRE 9: SITEMAP URL CANLILIK ÇAPRAZ KONTROL
# ═══════════════════════════════════════════════════════════════
echo "━━━ EVRE 9: SITEMAP URL CANLILIK ━━━"

SAMPLE_CHECK=0
SAMPLE_OK=0

if [ "$SM_COUNT" -gt 0 ] 2>/dev/null; then
    for SM in $SUB_SITEMAPS; do
        SAMPLE_URLS=$($CURL -s "$SM" 2>/dev/null | extract_first '<loc>[^<]+</loc>' | sed 's/<[^>]*>//g' | head -5 || true)
        for URL in $SAMPLE_URLS; do
            [ -z "$URL" ] && continue
            SAMPLE_CHECK=$((SAMPLE_CHECK + 1))
            URL_ST=$($CURL -s -o /dev/null -w "%{http_code}" "$URL" 2>/dev/null || echo "000")
            if [ "$URL_ST" = "200" ] || [ "$URL_ST" = "301" ] || [ "$URL_ST" = "308" ]; then
                SAMPLE_OK=$((SAMPLE_OK + 1))
            fi
        done
    done
fi

echo "  [43] URL Canlılık: ${SAMPLE_OK}/${SAMPLE_CHECK} canlı"
if [ "$SAMPLE_CHECK" -gt 0 ] 2>/dev/null; then
    if [ "$SAMPLE_OK" -eq "$SAMPLE_CHECK" ] 2>/dev/null; then
        add_result "L9_URL_Liveness" "PASS" "${SAMPLE_OK}/${SAMPLE_CHECK} URL canli"
    else
        add_result "L9_URL_Liveness" "WARN" "${SAMPLE_OK}/${SAMPLE_CHECK} canli"
    fi
else
    add_result "L9_URL_Liveness" "WARN" "URL check yapılamadı"
fi

echo ""

# ═══════════════════════════════════════════════════════════════
# FİNAL RAPOR
# ═══════════════════════════════════════════════════════════════

TOTAL_TESTS=$((PASS_COUNT + FAIL_COUNT + WARN_COUNT + INFO_COUNT))
PASS_RATE=0
if [ "$TOTAL_TESTS" -gt 0 ] 2>/dev/null; then
    PASS_RATE=$((PASS_COUNT * 100 / TOTAL_TESTS))
fi

VERDICT="BLOCKED"
VERDICT_REASON=""
if [ "$FAIL_COUNT" -eq 0 ] 2>/dev/null; then
    VERDICT="PRODUCTION READY"
    VERDICT_REASON="Sıfır hata - deploy kilidi kapalı"
elif [ "$FAIL_COUNT" -le 2 ] 2>/dev/null; then
    VERDICT="CONDITIONAL GO"
    VERDICT_REASON="${FAIL_COUNT} minor hata"
elif [ "$FAIL_COUNT" -le 5 ] 2>/dev/null; then
    VERDICT="NEEDS WORK"
    VERDICT_REASON="${FAIL_COUNT} hata - düzeltme gerekli"
else
    VERDICT="BLOCKED"
    VERDICT_REASON="${FAIL_COUNT} kritik hata - deploy edilemez"
fi

# JSON
cat > "$REPORT_FILE" << JSONEOF
{
  "report_type": "CbamValid-Ust-Onem-v2",
  "version": "2.0",
  "generated_at": "$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S')",
  "domain": "cbamvalid.com",
  "canonical_url": "${CANONICAL_URL}",
  "dual_200_detected": ${DUAL_200},
  "dns": "${IP_ADDR}",
  "summary": {
    "total_checks": ${TOTAL_TESTS},
    "pass": ${PASS_COUNT},
    "fail": ${FAIL_COUNT},
    "warn": ${WARN_COUNT},
    "info": ${INFO_COUNT},
    "pass_rate": "${PASS_RATE}%",
    "verdict": "${VERDICT}",
    "verdict_reason": "${VERDICT_REASON}"
  },
  "results": [${RESULTS}]
}
JSONEOF

# Konsol Özet
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   CBAMVALID.COM — ÜST ÖNEM SEO TEST RAPORU v2.0            ║"
echo "╠══════════════════════════════════════════════════════════════╣"
printf "║  Canonical URL: %-42s ║\n" "${CANONICAL_URL}"
printf "║  Toplam Kontrol: %-42s ║\n" "${TOTAL_TESTS}"
printf "║  ✅ PASS:  %-45s ║\n" "${PASS_COUNT}"
printf "║  ❌ FAIL:  %-45s ║\n" "${FAIL_COUNT}"
printf "║  ⚠️  WARN:  %-45s ║\n" "${WARN_COUNT}"
printf "║  ℹ️  INFO:  %-45s ║\n" "${INFO_COUNT}"
printf "║  Başarı Oranı: %-41s ║\n" "${PASS_RATE}%"
echo "╠══════════════════════════════════════════════════════════════╣"
printf "║  🏁 KARAR: %-46s ║\n" "${VERDICT}"
printf "║  Sebep: %-49s ║\n" "${VERDICT_REASON}"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "📄 JSON Rapor: ${REPORT_FILE}"
echo "📅 Bitiş: $(date '+%Y-%m-%dT%H:%M:%S%z')"
echo ""

if [ "$VERDICT" = "BLOCKED" ]; then
    echo "🚫 CRITICAL: Deploy kilidi AÇIK. ${FAIL_COUNT} hata giderilmeden deploy EDİLEMEZ."
    exit 1
elif [ "$VERDICT" = "NEEDS WORK" ]; then
    echo "🔧 DÜZELTME GEREKLİ: ${FAIL_COUNT} hata var."
    exit 1
elif [ "$VERDICT" = "CONDITIONAL GO" ]; then
    echo "⚠️  KOŞULLU ONAY: ${FAIL_COUNT} minor hata. Düzeltme planı ile deploy edilebilir."
    exit 0
else
    echo "✅ ZERO-DEFECT PRODUCTION READY. Güvenle deploy edilebilir."
    exit 0
fi
