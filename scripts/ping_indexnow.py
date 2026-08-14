#!/usr/bin/env python3
import json
import urllib.request
import urllib.error

INDEXNOW_KEY = "cbamvalid-aeo-indexnow-7f3c9e2a"
HOST = "cbamvalid.com"
KEY_LOCATION = f"https://{HOST}/cbamvalid-aeo-indexnow-7f3c9e2a.txt"
URL_LIST = [
    "https://cbamvalid.com/",
    "https://cbamvalid.com/product",
    "https://cbamvalid.com/pricing",
    "https://cbamvalid.com/methodology",
    "https://cbamvalid.com/cn-code",
    "https://cbamvalid.com/answers",
    "https://cbamvalid.com/glossary",
]
ENDPOINTS = ["https://api.indexnow.org/indexnow", "https://www.bing.com/indexnow"]

def ping():
    payload = {"host": HOST, "key": INDEXNOW_KEY, "keyLocation": KEY_LOCATION, "urlList": URL_LIST}
    data = json.dumps(payload).encode('utf-8')
    headers = {'Content-Type': 'application/json; charset=utf-8', 'User-Agent': 'IndexNow-Notifier/2.0'}
    for ep in ENDPOINTS:
        try:
            req = urllib.request.Request(ep, data=data, headers=headers, method='POST')
            with urllib.request.urlopen(req, timeout=10) as resp:
                print(f"✅ {ep} -> HTTP {resp.getcode()}")
        except Exception as e:
            print(f"⚠️ {ep} -> {e}")

if __name__ == "__main__":
    ping()
