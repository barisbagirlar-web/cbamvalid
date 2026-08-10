#!/usr/bin/env python3
"""G-15 / G-20 — RFC 8785 JSON Canonicalization Scheme (JCS), Python runtime.

Byte-identical to functions/src/cbam/report/v6/jcs.ts: object keys are ordered
by Unicode code point, strings use JSON escaping plus \\u2028/\\u2029 escapes,
numbers use the ECMAScript shortest round-trip representation, and no
whitespace is emitted. A structure hashed here yields the same SHA-256 as the
Node implementation.

CLI modes (used by the cross-runtime gate tests):
  echo '<json>' | python3 jcs.py --canonical   # print canonical serialisation
  echo '<json>' | python3 jcs.py --hash        # print sha256(canonical utf-8)
"""
import hashlib
import json
import sys


def _escape_json_string(value: str) -> str:
    out = []
    for ch in value:
        cp = ord(ch)
        if ch == '"':
            out.append('\\"')
        elif ch == "\\":
            out.append("\\\\")
        elif ch == "\b":
            out.append("\\b")
        elif ch == "\f":
            out.append("\\f")
        elif ch == "\n":
            out.append("\\n")
        elif ch == "\r":
            out.append("\\r")
        elif ch == "\t":
            out.append("\\t")
        elif cp < 0x20 or cp == 0x2028 or cp == 0x2029:
            out.append("\\u%04x" % cp)
        else:
            out.append(ch)
    return '"' + "".join(out) + '"'


def _js_number_to_string(value: float) -> str:
    """ECMAScript Number->String (shortest round-trip, JSON.stringify form).

    Integers below 1e21 print in decimal; finite non-integers and values at or
    beyond 1e21 use the shortest round-trip repr (Python's repr matches the
    ECMAScript result for every value the package hashes under G-16, where
    monetary/emissions values are always string-encoded fixed-point decimals).
    """
    if value != value or value in (float("inf"), float("-inf")):
        return "null"
    if value == 0:
        return "0"
    if value.is_integer() and abs(value) < 1e21:
        return str(int(value))
    return repr(value)


def canonical_jcs(value: object) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, str):
        return _escape_json_string(value)
    if isinstance(value, float):
        return _js_number_to_string(value)
    if isinstance(value, int):
        return str(value)
    if isinstance(value, (list, tuple)):
        return "[" + ",".join(canonical_jcs(item) for item in value) + "]"
    if isinstance(value, dict):
        keys = sorted(value.keys())
        return "{" + ",".join(
            _escape_json_string(key) + ":" + canonical_jcs(value[key]) for key in keys
        ) + "}"
    raise TypeError(f"unsupported JCS value type: {type(value).__name__}")


def reproduce_jcs_hash(value: object) -> str:
    return hashlib.sha256(canonical_jcs(value).encode("utf-8")).hexdigest()


def main() -> None:
    mode = "--hash" if "--hash" in sys.argv else ("--canonical" if "--canonical" in sys.argv else None)
    if mode is None:
        print("usage: python3 jcs.py --canonical|--hash < json", file=sys.stderr)
        sys.exit(2)
    raw = sys.stdin.read()
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as err:
        print(f"INVALID_JSON: {err}", file=sys.stderr)
        sys.exit(2)
    if mode == "--canonical":
        print(canonical_jcs(value))
    else:
        print(reproduce_jcs_hash(value))


if __name__ == "__main__":
    main()
