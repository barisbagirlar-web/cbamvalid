/**
 * G-16 — no-float-in-hashed-fields.
 *
 * Monetary, emissions and rate values entering a hash MUST be string-encoded
 * fixed-point decimals (e.g. "780000.000000"), never IEEE 754 numbers. This
 * rule blocks number literals passed directly into canonical serialisers and
 * hash builders. Values that arrive through variables or spreads are enforced
 * at runtime by assertNoFloatFieldsInHash (see jcs.ts).
 */

const HASH_FUNCTION_NAMES = new Set([
  "canonicalJcs",
  "reproduceJcsHash",
  "hashObject",
  "canonicalSerialization",
  "reproduceHash",
  "canonical",
]);

function calleeName(node) {
  if (node.type === "Identifier") return node.name;
  if (node.type === "MemberExpression") return node.property.type === "Identifier" ? node.property.name : null;
  return null;
}

function isNumberLiteral(node) {
  if (node.type === "Literal" && typeof node.value === "number") return true;
  if (node.type === "UnaryExpression" && node.operator === "-" && isNumberLiteral(node.argument)) return true;
  return false;
}

/** @type {import("eslint").Rule.RuleModule} */
export const noFloatInHashedFields = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Hashed fields must not carry IEEE 754 number literals; use string-encoded fixed-point decimals (G-16).",
    },
    messages: {
      floatInHash: "Hashed field uses an IEEE 754 number literal; encode monetary/emissions/rates as string fixed-point decimals (G-16).",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!HASH_FUNCTION_NAMES.has(calleeName(node.callee))) return;
        const firstArg = node.arguments[0];
        if (!firstArg || firstArg.type !== "ObjectExpression") return;
        for (const property of firstArg.properties) {
          if (property.type !== "Property" || property.computed) continue;
          if (isNumberLiteral(property.value)) {
            context.report({ node: property, messageId: "floatInHash" });
          }
        }
      },
    };
  },
};
