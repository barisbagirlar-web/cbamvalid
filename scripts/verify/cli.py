#!/usr/bin/env python3
"""Offline package verifier CLI — Python runtime (G-20).

Byte-equivalent to scripts/verify/cli.js: re-hashes manifest components,
verifies the manifest detached signature schema-aware (RSA-4096 PSS or legacy
PKCS#1 v1.5, chosen from the signature metadata), and checks the Calculation
Trace structure. Shipped inside sealed ZIPs under Supporting_Evidence/verify/.

Requires `cryptography` (see requirements.txt).
"""
import base64
import hashlib
import json
import os
import re
import sys

try:
    from cryptography.exceptions import InvalidSignature
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import padding
    from cryptography.hazmat.primitives.serialization import load_pem_public_key
except ImportError as err:  # pragma: no cover
    print(f"FAIL: cryptography is required: pip install -r requirements.txt ({err})", file=sys.stderr)
    sys.exit(3)

_PSS_SALT_LENGTH = 32

exit_code = 0


def fail(msg: str) -> None:
    global exit_code
    print(f"FAIL: {msg}", file=sys.stderr)
    if exit_code == 0:
        exit_code = 1


def pass_msg(msg: str) -> None:
    print(f"PASS: {msg}")


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main() -> None:
    global exit_code
    args = sys.argv[1:]
    pkg_idx = args.index("--package") if "--package" in args else -1
    if pkg_idx < 0 or pkg_idx + 1 >= len(args):
        print("Usage: python3 verify/cli.py --package <dir-or-extracted-zip> [--strict]", file=sys.stderr)
        sys.exit(2)
    root = os.path.abspath(args[pkg_idx + 1])
    strict = "--strict" in args

    manifest_path = os.path.join(root, "Data Integrity Manifest.json")
    if not os.path.exists(manifest_path):
        fail("Data Integrity Manifest.json missing")
        return
    with open(manifest_path, "r", encoding="utf-8") as fh:
        manifest = json.load(fh)
    files = manifest.get("files") if isinstance(manifest.get("files"), list) else []
    hash_fails = 0
    for entry in files:
        rel = entry.get("path") or entry.get("fileName") or entry.get("name")
        if not rel:
            continue
        full = os.path.join(root, rel)
        if not os.path.exists(full):
            fail(f"Missing component: {rel}")
            hash_fails += 1
            continue
        digest = sha256(open(full, "rb").read())
        expected = (entry.get("sha256") or entry.get("hash") or "").lower()
        if expected and digest != expected:
            fail(f"Hash mismatch: {rel}")
            hash_fails += 1
    if hash_fails == 0:
        pass_msg(f"Re-hashed {len(files)} manifest components")

    sig_path = os.path.join(root, "Manifest Signature.sig")
    if os.path.exists(sig_path):
        try:
            with open(sig_path, "r", encoding="utf-8") as fh:
                sig_json = json.load(fh)
            pem = sig_json.get("publicKeyPem")
            signature = base64.b64decode(sig_json.get("signatureBase64") or "")
            algorithm = str(sig_json.get("algorithm") or sig_json.get("signatureAlgorithm") or "")
            if pem and signature:
                with open(manifest_path, "rb") as fh:
                    manifest_bytes = fh.read()
                # Schema-aware verification (G-19): legacy PKCS#1 v1.5 packages
                # keep verifying through the legacy path, new packages through
                # RSA-4096 PSS (RFC 8017 §8.1).
                is_pss = re.search(r"RSA_SIGN_PSS|PSS", algorithm, re.IGNORECASE) is not None
                public_key = load_pem_public_key(pem.encode("utf-8"))
                try:
                    if is_pss:
                        public_key.verify(
                            signature,
                            manifest_bytes,
                            padding.PSS(
                                mgf=padding.MGF1(hashes.SHA256()),
                                salt_length=_PSS_SALT_LENGTH,
                            ),
                            hashes.SHA256(),
                        )
                    else:
                        public_key.verify(signature, manifest_bytes, padding.PKCS1v15(), hashes.SHA256())
                except InvalidSignature:
                    fail("Manifest signature verification failed")
                else:
                    scheme = "PSS" if is_pss else "PKCS1v1.5"
                    pass_msg(f"Manifest detached signature verified (embedded public key, scheme={scheme})")
            else:
                fail("Manifest Signature.sig missing publicKeyPem or signatureBase64")
        except Exception as err:  # parse / key load errors
            fail(f"Signature parse/verify error: {err}")
    elif strict:
        fail("Manifest Signature.sig missing")

    trace_path = os.path.join(root, "Calculation Trace.json")
    if os.path.exists(trace_path):
        with open(trace_path, "r", encoding="utf-8") as fh:
            trace = json.load(fh)
        calc = trace.get("calculation") or trace
        nodes = calc.get("trace") or []
        if not isinstance(nodes, list) or len(nodes) == 0:
            fail("Calculation Trace has no nodes")
        else:
            pass_msg(
                "Calculation Trace present with %d nodes; root=%s"
                % (len(nodes), calc.get("calculationRootHash") or "n/a")
            )
            for node in nodes:
                if not node.get("formulaId") or node.get("outputValue") is None or not node.get("calculationHash"):
                    fail(f"Incomplete calc node: {json.dumps(node.get('formulaId'))}")
                if "undefined" in str(node.get("formulaId")) or re.search(r"CBAM_GOOD_$", str(node.get("formulaId"))):
                    fail(f"Truncated/invalid formulaId: {node.get('formulaId')}")
    elif strict:
        fail("Calculation Trace.json missing")

    out = os.path.join(root, "VERIFICATION_REPORT.txt")
    verdict = "FAIL" if exit_code else "PASS"
    try:
        with open(out, "w", encoding="utf-8") as fh:
            fh.write(
                "\n".join(
                    [
                        "CBAMValid Independent Package Verification",
                        f"Package root: {root}",
                        f"Exit: {verdict}",
                        "",
                    ]
                )
            )
    except OSError:
        pass

    print(f"VERIFICATION_REPORT: {verdict}")


if __name__ == "__main__":
    main()
    sys.exit(exit_code)
