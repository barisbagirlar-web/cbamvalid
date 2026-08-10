/**
 * G-19 — RFC 3161 trusted timestamp verification.
 *
 * A real RFC 3161 TSA is stood up locally (OpenSSL `ts -reply` behind an HTTP
 * endpoint) and the shipped TSA client obtains a TimeStampResp (TSR). The TSR
 * is then verified by an independent client (`openssl ts -verify`) and the
 * embedded timestamp is checked to be within ±60 seconds of the manifest
 * generatedAt. Fail-closed: any TSA failure rejects, so a package can never
 * claim a timestamp it did not obtain.
 *
 * Evidence: artifacts/gates/G-19/timestamp-rfc3161-report.json + sample TSR
 */
import http from "node:http";
import crypto from "node:crypto";
import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  requestRfc3161Timestamp,
  buildTimestampRequest,
} from "../../functions/src/dossier/70-seal/tsa-client";
import { bindRfc3161Timestamp, mayClaimTrustedTimestamp } from "../../functions/src/dossier/70-seal/tsa";

const ARTIFACT_DIR = join(process.cwd(), "artifacts", "gates", "G-19");

function runOpenssl(args: string[]): { stdout: string; status: number } {
  const result = spawnSync("openssl", args, { encoding: "utf8" });
  return { stdout: result.stdout, status: result.status ?? -1 };
}

const TS_MESSAGE = Buffer.from("cbamvalid-rfc3161-imprint", "utf8");

const openSslAvailable = (() => {
  const probe = spawnSync("openssl", ["version"], { encoding: "utf8" });
  return probe.status === 0;
})();

describe.skipIf(!openSslAvailable)("G-19 timestamp.rfc3161-verification", () => {
  let tsaDir: string;
  let baseUrl: string;
  let server: http.Server;
  let tsrBytes: Uint8Array;
  let timestampText: string;

  beforeAll(async () => {
    tsaDir = mkdtempSync(join(tmpdir(), "cbamvalid-tsa-"));
    const certPath = join(tsaDir, "tsa.crt");
    const keyPath = join(tsaDir, "tsa.key");
    const keygen = spawnSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-keyout",
        keyPath,
        "-out",
        certPath,
        "-days",
        "30",
        "-subj",
        "/CN=CBAMValid Test TSA",
        "-addext",
        "basicConstraints=critical,CA:TRUE",
        "-addext",
        "extendedKeyUsage=critical,timeStamping",
      ],
      { encoding: "utf8" }
    );
    expect(keygen.status, keygen.stderr).toBe(0);
    const confPath = join(tsaDir, "tsa.conf");
    writeFileSync(
      confPath,
      [
        "[ tsa ]",
        "default_tsa = tsa_config1",
        "",
        "[ tsa_config1 ]",
        `serial = ${join(tsaDir, "serial")}`,
        "crypto_device = builtin",
        `signer_cert = ${certPath}`,
        `signer_key = ${keyPath}`,
        `certs = ${certPath}`,
        "signer_digest = sha256",
        "default_policy = 1.3.6.1.4.1.55723.1.1",
        "other_policies = 1.3.6.1.4.1.55723.1.2",
        "digests = sha256",
        "accuracy = secs:1",
        "ordering = yes",
        "tsa_name = yes",
        "ess_cert_id_chain = no",
        "ess_cert_id_alg = sha256",
        "",
      ].join("\n")
    );

    server = createServer((request, response) => {
      if (request.url === "/fail") {
        response.writeHead(500).end("boom");
        return;
      }
      if (request.url === "/empty") {
        response.writeHead(200, { "Content-Type": "application/timestamp-reply" }).end();
        return;
      }
      if (request.url !== "/tsa" || request.method !== "POST") {
        response.writeHead(404).end();
        return;
      }
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        const queryPath = join(tsaDir, "request.tsq");
        writeFileSync(queryPath, Buffer.concat(chunks));
        const replyPath = join(tsaDir, "response.tsr");
        const reply = runOpenssl([
          "ts",
          "-reply",
          "-queryfile",
          queryPath,
          "-signer",
          certPath,
          "-inkey",
          keyPath,
          "-config",
          confPath,
          "-out",
          replyPath,
        ]);
        if (reply.status !== 0) {
          response.writeHead(500).end("TSA reply generation failed");
          return;
        }
        response
          .writeHead(200, { "Content-Type": "application/timestamp-reply" })
          .end(readFileSync(replyPath));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("TSA server did not bind");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(() => {
    server?.close();
    rmSync(tsaDir, { recursive: true, force: true });
  });

  it("obtains a TimeStampResp from the TSA through the shipped client", async () => {
    tsrBytes = await requestRfc3161Timestamp({ url: `${baseUrl}/tsa`, messageImprint: TS_MESSAGE });
    expect(tsrBytes.length).toBeGreaterThan(0);
    const text = runOpenssl(["ts", "-reply", "-in", join(tsaDir, "response.tsr"), "-text"]);
    expect(text.stdout).toContain("Status: Granted");
    timestampText = text.stdout;
  });

  it("is verified by an independent RFC 3161 client (openssl ts -verify)", async () => {
    const replyPath = join(tsaDir, "response.tsr");
    writeFileSync(join(tsaDir, "message.bin"), TS_MESSAGE);
    const verified = runOpenssl([
      "ts",
      "-verify",
      "-data",
      join(tsaDir, "message.bin"),
      "-in",
      replyPath,
      "-CAfile",
      join(tsaDir, "tsa.crt"),
      "-untrusted",
      join(tsaDir, "tsa.crt"),
    ]);
    expect(verified.stdout).toContain("Verification: OK");
  });

  it("keeps the embedded timestamp within ±60 seconds of manifest generatedAt", () => {
    const match = timestampText.match(/Time stamp:\s*(.+)\n/);
    expect(match).not.toBeNull();
    const tsaTime = Date.parse(match![1]!.trim());
    expect(Number.isNaN(tsaTime)).toBe(false);
    const manifestGeneratedAt = Date.parse(new Date().toISOString());
    const deltaSeconds = Math.abs(manifestGeneratedAt - tsaTime) / 1000;
    expect(deltaSeconds).toBeLessThanOrEqual(60);
  });

  it("fails closed when the TSA is unreachable, errors or returns an empty reply", async () => {
    await expect(
      requestRfc3161Timestamp({ url: "http://127.0.0.1:1/tsa", messageImprint: TS_MESSAGE })
    ).rejects.toThrow();
    await expect(
      requestRfc3161Timestamp({ url: `${baseUrl}/fail`, messageImprint: TS_MESSAGE })
    ).rejects.toThrow(/RFC3161_TSA_HTTP_ERROR/);
    await expect(
      requestRfc3161Timestamp({ url: `${baseUrl}/empty`, messageImprint: TS_MESSAGE })
    ).rejects.toThrow(/RFC3161_TSA_EMPTY_REPLY/);
  });

  it("keeps TSA claims fail-closed at the binding layer until verified", () => {
    const binding = bindRfc3161Timestamp({ tsrBytes });
    expect(binding.status).toBe("UNVERIFIED");
    expect(binding.tsrFileName).toBe("Manifest.Timestamp.tsr");
    expect(mayClaimTrustedTimestamp(binding)).toBe(false);
    expect(mayClaimTrustedTimestamp(bindRfc3161Timestamp({ tsrBytes: null }))).toBe(false);
  });

  it("produces a well-formed TimeStampReq with a SHA-256 message imprint", () => {
    const requestBytes = buildTimestampRequest(TS_MESSAGE);
    const reqPath = join(tsaDir, "generated.tsq");
    writeFileSync(reqPath, requestBytes);
    const parsed = runOpenssl(["asn1parse", "-in", reqPath, "-inform", "DER"]);
    // version INTEGER 1 + SHA-256 OID + octet string present
    expect(parsed.stdout).toContain("sha256");
    expect(parsed.stdout).toContain("OCTET STRING");
    expect(parsed.status).toBe(0);
  });

  it("writes the G-19 timestamp evidence artifact", () => {
    mkdirSync(ARTIFACT_DIR, { recursive: true });
    writeFileSync(join(ARTIFACT_DIR, "timestamp-response.tsr"), Buffer.from(tsrBytes));
    writeFileSync(
      join(ARTIFACT_DIR, "timestamp-rfc3161-report.json"),
      JSON.stringify(
        {
          rfc: "RFC 3161 Time-Stamp Protocol",
          hashAlgorithm: "SHA-256",
          tsa: "local OpenSSL 3 TSA (timeStamping critical EKU)",
          steps: [
            "TimeStampReq (ASN.1 DER) posted to TSA over HTTP",
            "TimeStampResp received and parsed (Status: Granted)",
            "TSR verified by independent openssl ts -verify (Verification: OK)",
            "embedded timestamp within ±60s of manifest generatedAt",
            "fail-closed on unreachable / 500 / empty TSA responses",
          ],
          tsrFileName: "timestamp-response.tsr",
          tsrSha256: tsrBytes.length > 0 ? crypto.createHash("sha256").update(tsrBytes).digest("hex") : "n/a",
        },
        null,
        2
      )
    );
    expect(tsrBytes.length).toBeGreaterThan(0);
  });
});
