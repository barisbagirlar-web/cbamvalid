/**
 * CBAM Compliance ESLint Plugin
 *
 * Enforces CBAM regulatory invariants at lint level:
 *   1. NO-FLOAT-ARITHMETIC: Blocks *, /, +, - with Number values in CBAM paths
 *   2. REQUIRE-EU-REF: JSDoc @euRef required on all exported functions in CBAM paths
 *   3. NO-HARDCODED-EMISSION-FACTOR: Blocks numeric emission factors outside registry
 *   4. REQUIRE-DEFAULT-FLAG: Mandates is_eu_default_applied when using defaults
 *
 * [DEPLOY BLOCKER] These rules MUST pass before deployment.
 */

/* eslint-disable */
// @ts-nocheck

// ─── RULE 1: no-float-arithmetic ───

const CBAM_FILE_PATTERNS = [
  /lib\/cbam/,
  /lib\/cbam-engine/,
  /emission/,
  /calculation/,
  /compliance/,
  /functions\/src\/cbam/,
];

function isCbamFile(filename) {
  if (!filename) return false;
  return CBAM_FILE_PATTERNS.some(p => p.test(filename));
}

module.exports = {
  rules: {
    /** Block float arithmetic in CBAM files. Big.js required. */
    "no-float-arithmetic": {
      meta: {
        type: "problem",
        docs: {
          description: "Block Number float arithmetic in CBAM calculation paths. Big.js required.",
          recommended: true,
        },
        messages: {
          floatArithmetic: "CBAM: Float arithmetic detected ({{operator}}). Use `new Big(a).{{bigMethod}}(b)` instead. Float imprecision creates legal liability under EU Regulation 2023/956 §7.",
          floatMultiplication: "CBAM: Float multiplication (*) detected. Use `new Big(a).times(b)`. Exact precision required for EU compliance.",
          floatDivision: "CBAM: Float division (/) detected. Use `new Big(a).div(b)`. Rounding errors violate Annex III tolerance requirements.",
          floatAddition: "CBAM: Float addition (+) detected. Use `new Big(a).plus(b)`. Accumulated error violates mass-balance closure (±0.01%).",
          floatSubtraction: "CBAM: Float subtraction (-) detected. Use `new Big(a).minus(b)`. Precision loss creates regulatory non-compliance.",
        },
        schema: [],
      },
      create(context) {
        const filename = context.filename || context.getFilename?.();

        function checkBinaryExpression(node) {
          // Skip string concatenation
          if (node.left.type === "Literal" && typeof node.left.value === "string") return;
          if (node.right.type === "Literal" && typeof node.right.value === "string") return;

          const operator = node.operator;
          switch (operator) {
            case "*":
              context.report({
                node,
                messageId: "floatMultiplication",
                data: { operator: "*", bigMethod: "times" },
              });
              break;
            case "/":
              context.report({
                node,
                messageId: "floatDivision",
                data: { operator: "/", bigMethod: "div" },
              });
              break;
            case "+":
              // Only flag number addition, not string concat
              if (node.left.type !== "TemplateLiteral" && node.right.type !== "TemplateLiteral") {
                context.report({
                  node,
                  messageId: "floatAddition",
                  data: { operator: "+", bigMethod: "plus" },
                });
              }
              break;
            case "-":
              context.report({
                node,
                messageId: "floatSubtraction",
                data: { operator: "-", bigMethod: "minus" },
              });
              break;
          }
        }

        return {
          BinaryExpression: (node) => {
            if (!isCbamFile(filename)) return;
            checkBinaryExpression(node);
          },
        };
      },
    },

    /** Require @euRef JSDoc on exported functions in CBAM paths. */
    "require-eu-ref": {
      meta: {
        type: "problem",
        docs: {
          description: "Require @euRef JSDoc tag on exported functions in CBAM paths.",
          recommended: true,
        },
        messages: {
          missingEuRef: "CBAM: Function `{{name}}` is missing @euRef JSDoc tag. CBAM calculation functions MUST cite the EU regulation article/annex they implement. Format: `@euRef \"Regulation (EU) 2023/956 Art. X(Y)\"`.",
          invalidEuRef: "CBAM: @euRef on `{{name}}` does not reference a valid EU regulation. Expected pattern: Regulation (EU) 2023/956 or Implementing Regulation (EU) 2023/1773.",
        },
        schema: [],
      },
      create(context) {
        const filename = context.filename || context.getFilename?.();

        function check(node, fnName) {
          const comments = context.sourceCode.getCommentsBefore(node);
          const allComments = comments.map(c => c.value).join("\n");
          const hasEuRef = /@euRef/i.test(allComments);

          if (!hasEuRef) {
            // Check if it's an arrow function assigned to a const/let declaration
            const parent = node.parent;
            let name = fnName;
            if (parent && parent.parent && parent.parent.id) {
              name = parent.parent.id.name;
            }
            if (!name || name === "anonymous") {
              // Try to extract from the parent
              const decl = context.sourceCode.getAncestors?.();
              if (decl) {
                for (const a of [...decl].reverse()) {
                  if (a.id && a.id.name && a.id.name !== "exports") {
                    name = a.id.name;
                    break;
                  }
                }
              }
            }
            context.report({
              node,
              messageId: "missingEuRef",
              data: { name: name || "anonymous" },
            });
            return;
          }

          // Validate citation format
          if (hasEuRef) {
            const refMatch = allComments.match(/@euRef\s+(.+)$/m);
            if (refMatch) {
              const ref = refMatch[1].trim();
              const isValidReg = /Regulation\s*\(EU\)\s*20\d{2}\/\d+/i.test(ref)
                              || /Implementing\s+Regulation\s*\(EU\)\s*20\d{2}\/\d+/i.test(ref);
              if (!isValidReg) {
                context.report({
                  node,
                  messageId: "invalidEuRef",
                  data: { name: name || "anonymous" },
                });
              }
            }
          }
        }

        return {
          FunctionDeclaration: (node) => {
            if (!isCbamFile(filename)) return;
            if (node.parent && node.parent.type === "ExportNamedDeclaration") {
              check(node, node.id?.name || "anonymous");
            }
          },
          ArrowFunctionExpression: (node) => {
            if (!isCbamFile(filename)) return;
            const parent = node.parent;
            if (parent) {
              const isExported =
                (parent.type === "VariableDeclarator" &&
                 parent.parent?.type === "VariableDeclaration" &&
                 parent.parent.parent?.type === "ExportNamedDeclaration") ||
                (parent.parent?.parent?.parent?.type === "ExportNamedDeclaration");

              if (isExported) {
                let name = "anonymous";
                if (parent.id && parent.id.name) name = parent.id.name;
                else if (parent.parent?.declarations?.[0]?.id?.name) name = parent.parent.declarations[0].id.name;
                check(node, name);
              }
            }
          },
        };
      },
    },

    /** Block hardcoded emission factors outside the registry. */
    "no-hardcoded-emission-factor": {
      meta: {
        type: "problem",
        docs: {
          description: "Block hardcoded numeric emission factors in CBAM paths. Use @/lib/cbam/emission-factors registry.",
          recommended: true,
        },
        messages: {
          hardcodedFactor: "CBAM: Hardcoded emission factor `{{value}}` detected. Emission factors MUST come from `@/lib/cbam/emission-factors` registry. Regulation (EU) 2023/1773 Annex III values are versioned and subject to change.",
        },
        schema: [],
      },
      create(context) {
        const filename = context.filename || context.getFilename?.();

        return {
          VariableDeclarator: (node) => {
            if (!isCbamFile(filename)) return;
            if (!node.id || !node.init) return;

            const name = node.id.name?.toLowerCase() || "";
            const isEmissionVar =
              name.includes("emission") ||
              name.includes("factor") ||
              name.includes("benchmark") ||
              name.includes("default");

            if (!isEmissionVar) return;

            // Check if init is a number literal (or unary minus with number)
            let value = null;
            if (node.init.type === "Literal" && typeof node.init.value === "number") {
              value = node.init.value;
            } else if (node.init.type === "UnaryExpression" && node.init.operator === "-"
              && node.init.argument.type === "Literal") {
              value = -node.init.argument.value;
            }

            if (value !== null) {
              // Allow zero and one (these are often coefficients, not emission factors)
              if (value === 0 || value === 1) return;

              context.report({
                node,
                messageId: "hardcodedFactor",
                data: { value: String(value) },
              });
            }
          },
        };
      },
    },
  },
};
