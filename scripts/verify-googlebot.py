"""
§22 / Ek Kod-9: Googlebot Doğrulama (Reverse DNS + Forward DNS)

Protocol: Verifies that an IP claiming to be Googlebot actually belongs
to Google. Dual verification: reverse DNS lookup + forward DNS confirmation.

[GOOGLE] Google's official bot verification method
[INTERNAL] Security gate — validates that WAF/CDN isn't blocking real Googlebot
 [INTERNAL] Security gate

Usage: python3 scripts/verify-googlebot.py <IP_ADDRESS>
"""

import socket
import sys
import re

# ─── Known Googlebot IP ranges (2026) ───
# Source: https://developers.google.com/search/apis/ipranges/googlebot.json
GOOGLEBOT_Ip_RANGES = [
    # Googlebot (crawling)
    "66.249.64.0/19",     # googlebot.com
    "66.249.64.0/27",     # verify
    # Additional ranges from Google's official list
    "192.178.0.0/15",
    "64.233.160.0/19",
    "216.239.32.0/19",
    "64.233.160.0/15",    # Google
]

# ─── Googlebot hostname patterns ───
GOOGLEBOT_HOSTNAME_PATTERNS = [
    re.compile(r'\.googlebot\.com$'),
    re.compile(r'\.google\.com$'),
    re.compile(r'^crawl-[a-z0-9-]+\.googlebot\.com$'),
    re.compile(r'^rate-limited-proxy-[a-z0-9-]+\.google\.com$'),
]


def ip_to_int(ip: str) -> int:
    """Convert IPv4 to integer for range checking."""
    parts = ip.split('.')
    return (int(parts[0]) << 24) + (int(parts[1]) << 16) + \
           (int(parts[2]) << 8) + int(parts[3])


def parse_cidr(cidr: str) -> tuple[int, int]:
    """Parse CIDR notation to (network_int, mask_int)."""
    ip, prefix = cidr.split('/')
    ip_int = ip_to_int(ip)
    mask = (0xFFFFFFFF << (32 - int(prefix))) & 0xFFFFFFFF
    return ip_int, mask


def ip_in_cidr(ip: str, cidr: str) -> bool:
    """Check if IP is in CIDR range."""
    ip_int = ip_to_int(ip)
    net_int, mask = parse_cidr(cidr)
    return (ip_int & mask) == (net_int & mask)


def verify_googlebot(ip: str) -> tuple[bool, str]:
    """
    Two-step verification:
    1. Reverse DNS: lookup hostname from IP
    2. Forward DNS: verify hostname resolves back to same IP
    3. Hostname pattern: verify it matches Googlebot naming
    """

    # Step 1: Reverse DNS
    try:
        hostname = socket.gethostbyaddr(ip)[0]
    except socket.herror:
        return False, f"Reverse DNS failed for {ip} — no PTR record"
    except Exception as e:
        return False, f"Reverse DNS error for {ip}: {e}"

    # Step 2: Forward DNS verification (must resolve back to same IP)
    try:
        forward_ips = socket.gethostbyname_ex(hostname)[2]
    except socket.gaierror:
        return False, f"Forward DNS failed for {hostname}"
    except Exception as e:
        return False, f"Forward DNS error: {e}"

    if ip not in forward_ips:
        return False, f"Forward DNS mismatch: {ip} not in {forward_ips}"

    # Step 3: Hostname pattern check
    matches_pattern = any(pattern.search(hostname) for pattern in GOOGLEBOT_HOSTNAME_PATTERNS)
    if not matches_pattern:
        # Check IP range as fallback
        in_range = any(ip_in_cidr(ip, cidr) for cidr in GOOGLEBOT_Ip_RANGES)
        if in_range:
            return True, f"Verified (IP in Google range, hostname: {hostname})"
        return False, f"Hostname {hostname} does not match Googlebot patterns"

    return True, f"Verified: {hostname} → {ip} (Googlebot confirmed)"


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/verify-googlebot.py <IP_ADDRESS>")
        print("Example: python3 scripts/verify-googlebot.py 66.249.66.1")
        sys.exit(0)

    ip = sys.argv[1]

    # Basic IP format validation
    ip_pattern = re.compile(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$')
    if not ip_pattern.match(ip):
        print(f"[GOOGLEBOT] ❌ Invalid IP format: {ip}")
        sys.exit(1)

    is_googlebot, message = verify_googlebot(ip)

    if is_googlebot:
        print(f"[GOOGLEBOT] ✅ {message}")
        print("[GOOGLEBOT] This IP belongs to Googlebot. Yesil isik.")
        sys.exit(0)
    else:
        print(f"[GOOGLEBOT] ❌ {message}")
        print("[GOOGLEBOT] This IP is NOT a verified Googlebot. Kirmizi isik.")
        sys.exit(1)


if __name__ == "__main__":
    main()
