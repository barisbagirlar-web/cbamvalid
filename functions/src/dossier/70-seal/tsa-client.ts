/**
 * G-19 — RFC 3161 trusted timestamp client.
 *
 * Builds a TimeStampReq (ASN.1 DER) over the SHA-256 message imprint and posts
 * it to an RFC 3161 TSA over HTTP. Returns the raw TimeStampResp (TSR) bytes.
 * Fail-closed: a network failure, non-2xx response or empty reply throws, so a
 * package can never claim a trusted timestamp it did not actually obtain.
 */
import crypto from "node:crypto";

export const RFC3161_SHA256_OID = "2.16.840.1.101.3.4.2.1";
export const TSA_CONTENT_TYPE = "application/timestamp-query";

function derLength(length: number): Buffer {
  if (length < 0x80) return Buffer.from([length]);
  const bytes: number[] = [];
  let value = length;
  while (value > 0) {
    bytes.unshift(value & 0xff);
    value = Math.floor(value / 0x100);
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function derSequence(...children: Buffer[]): Buffer {
  const body = Buffer.concat(children);
  return Buffer.concat([Buffer.from([0x30]), derLength(body.length), body]);
}

function derOid(dotted: string): Buffer {
  const parts = dotted.split(".").map(Number);
  if (parts.length < 2 || parts[0]! > 2) {
    throw new Error(`RFC3161_UNSUPPORTED_OID:${dotted}`);
  }
  const encoded: number[] = [parts[0]! * 40 + parts[1]!];
  for (const part of parts.slice(2)) {
    const stack: number[] = [part & 0x7f];
    let value = Math.floor(part / 0x80);
    while (value > 0) {
      stack.unshift(0x80 | (value & 0x7f));
      value = Math.floor(value / 0x80);
    }
    encoded.push(...stack);
  }
  return Buffer.concat([Buffer.from([0x06]), derLength(encoded.length), Buffer.from(encoded)]);
}

function derInteger(value: bigint | number): Buffer {
  let v = typeof value === "bigint" ? value : BigInt(value);
  if (v < BigInt(0)) throw new Error("RFC3161_NEGATIVE_INTEGER_NOT_SUPPORTED");
  const bytes: number[] = [];
  do {
    bytes.unshift(Number(v & BigInt(0xff)));
    v >>= BigInt(8);
  } while (v > BigInt(0));
  if ((bytes[0]! & 0x80) !== 0) bytes.unshift(0);
  return Buffer.concat([Buffer.from([0x02]), derLength(bytes.length), Buffer.from(bytes)]);
}

function derOctetString(data: Uint8Array): Buffer {
  const body = Buffer.from(data);
  return Buffer.concat([Buffer.from([0x04]), derLength(body.length), body]);
}

function derBoolean(value: boolean): Buffer {
  return Buffer.from([0x01, 0x01, value ? 0xff : 0x00]);
}

/**
 * RFC 3161 TimeStampReq:
 *   SEQUENCE {
 *     version          INTEGER { v1(1) },
 *     messageImprint   SEQUENCE { hashAlgorithm, hashedMessage },
 *     nonce            INTEGER OPTIONAL,
 *     certReq          BOOLEAN DEFAULT FALSE
 *   }
 */
export function buildTimestampRequest(messageImprint: Uint8Array): Buffer {
  const digest = crypto.createHash("sha256").update(messageImprint).digest();
  const messageImprintSeq = derSequence(derSequence(derOid(RFC3161_SHA256_OID)), derOctetString(digest));
  const nonce = crypto.randomBytes(8).readBigUInt64BE();
  return derSequence(derInteger(1), messageImprintSeq, derInteger(nonce), derBoolean(false));
}

export interface RequestRfc3161TimestampParams {
  readonly url: string;
  readonly messageImprint: Uint8Array;
  readonly timeoutMs?: number;
}

export async function requestRfc3161Timestamp(
  params: RequestRfc3161TimestampParams
): Promise<Uint8Array> {
  const requestBody = buildTimestampRequest(params.messageImprint);
  const response = await fetch(params.url, {
    method: "POST",
    headers: { "Content-Type": TSA_CONTENT_TYPE, Accept: "application/timestamp-reply" },
    body: requestBody as unknown as BodyInit,
    signal: AbortSignal.timeout(params.timeoutMs ?? 10000),
  });
  if (!response.ok) {
    throw new Error(`RFC3161_TSA_HTTP_ERROR:${response.status}`);
  }
  const tsr = new Uint8Array(await response.arrayBuffer());
  if (tsr.length === 0) {
    throw new Error("RFC3161_TSA_EMPTY_REPLY");
  }
  return tsr;
}
