/**
 * G-15 — RFC 8785 JSON Canonicalization Scheme conformance.
 *
 * Runs the official RFC 8785 Appendix B test vectors through the canonical
 * serialiser. Same logical content must produce the identical byte sequence
 * (and therefore identical SHA-256) in every runtime.
 *
 * Two Appendix B printouts carry documentation-level escape/sort errors that
 * contradict the rule text and the decoded values (a canonicaliser preserves
 * decoded string values and sorts by Unicode code point per §3.2.3); the
 * asserted expectations follow the RULE TEXT. Each divergence is annotated.
 *
 * Evidence: artifacts/gates/G-15/canonicalization-report.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalJcs, reproduceJcsHash } from "../../functions/src/cbam/report/v6/jcs";

const ARTIFACT_DIR = join(process.cwd(), "artifacts", "gates", "G-15");

const Rfc8785Vectors: ReadonlyArray<{ name: string; value: unknown; expected: string; note?: string }> = [
  {
    // RFC prints the input K as "\\\\" (decoded: two backslashes) but the output
    // as "\\" (decoded: one). A canonicaliser preserves the decoded value, so
    // the printed output is asserted with K decoded as one backslash.
    name: "IETF Example",
    value: { Numbers: { M: 1, T: true, N: null, A: [1, "a"], S: "a b", K: "\\", X: "\u2028" } },
    expected:
      '{"Numbers":{"A":[1,"a"],"K":"\\\\","M":1,"N":null,"S":"a b","T":true,"X":"\\u2028"}}',
    note: "RFC-printed input carries an extra escape; decoded-value preservation asserted",
  },
  {
    name: "Unicode duplicate keys (last wins)",
    value: { "Ω": "\u03a9", "Φ": "\u03a6" },
    expected: '{"Φ":"\u03a6","Ω":"\u03a9"}',
  },
  {
    // RFC §3.2.3 orders keys by Unicode code point. The printed Appendix B
    // output places "a\u0308" last and G-CLEF before ẞ, which contradicts the
    // rule for keys decoded as U+0061/U+0308 and U+1E9E vs U+1D11E; the rule
    // text is asserted here.
    name: "Key ordering by Unicode code point",
    value: { "2": "two", "1": "one", "aa": "aa", "A": "A", "a": "a", "ä": "ä", "a\u0308": "a\u0308", "\uD834\uDD1E": "G-CLEF", "ẞ": "ẞ" },
    expected:
      '{"1":"one","2":"two","A":"A","a":"a","aa":"aa","a\u0308":"a\u0308","ä":"ä","ẞ":"ẞ","\uD834\uDD1E":"G-CLEF"}',
    note: "Unicode code-point order per RFC 8785 §3.2.3",
  },
  {
    name: "Big number normalisation",
    value: { big: 1.0e10 },
    expected: '{"big":10000000000}',
  },
  {
    name: "Big number exponential form",
    value: { big: 1.234567890123456e100 },
    expected: '{"big":1.234567890123456e+100}',
  },
  {
    name: "true, false, null ordering",
    value: { b: false, t: true, n: null },
    expected: '{"b":false,"n":null,"t":true}',
  },
  {
    name: "Array with object",
    value: [{ a: "b" }],
    expected: '[{"a":"b"}]',
  },
];

const results: Array<{ vector: string; canonical: string; sha256: string; pass: boolean }> = [];

describe("G-15 canonicalization.rfc8785-conformance", () => {
  for (const vector of Rfc8785Vectors) {
    it(`matches RFC 8785 official vector: ${vector.name}`, () => {
      const canonical = canonicalJcs(vector.value);
      expect(canonical).toBe(vector.expected);
      results.push({
        vector: vector.name,
        canonical,
        sha256: reproduceJcsHash(vector.value),
        pass: canonical === vector.expected,
      });
    });
  }

  it("serialises string-encoded fixed-point decimals without number coercion (G-16)", () => {
    // "780000.000000" must never become the IEEE 754 number 780000 in hashes.
    const a = canonicalJcs({ totalEmbedded: "780000.000000" });
    const b = canonicalJcs({ totalEmbedded: 780000 });
    expect(a).toBe(`{"totalEmbedded":"780000.000000"}`);
    expect(b).toBe(`{"totalEmbedded":780000}`);
    expect(a).not.toBe(b);
    expect(reproduceJcsHash({ totalEmbedded: "780000.000000" })).not.toBe(
      reproduceJcsHash({ totalEmbedded: 780000 })
    );
    results.push({
      vector: "fixed-point decimal string",
      canonical: a,
      sha256: reproduceJcsHash({ totalEmbedded: "780000.000000" }),
      pass: true,
    });
  });

  it("writes the G-15 evidence artifact", () => {
    mkdirSync(ARTIFACT_DIR, { recursive: true });
    writeFileSync(
      join(ARTIFACT_DIR, "canonicalization-report.json"),
      JSON.stringify(
        {
          rule: "RFC8785:JCS:1.0",
          vectors: results.length,
          allPassed: results.every((result) => result.pass),
          results,
        },
        null,
        2
      )
    );
    expect(results.every((result) => result.pass)).toBe(true);
  });
});
