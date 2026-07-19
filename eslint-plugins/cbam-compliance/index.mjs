/**
 * CBAM Compliance ESLint Plugin (ESM/flat-config compatible)
 *
 * Enforces CBAM regulatory invariants at lint level:
 *   - no-float-arithmetic: Blocks Number arithmetic in CBAM paths
 *   - require-eu-ref: @euRef JSDoc required on exported functions
 *   - no-hardcoded-emission-factor: Blocks hardcoded numeric factors
 *
 * Usage in eslint.config.mjs:
 *   import cbamCompliance from "./eslint-plugins/cbam-compliance/index.mjs";
 *   ...cbamCompliance.configs.strict,
 */

const CBAM_FILE_PATTERNS = [
  /lib\/cbam\/calculation/,
  /lib\/cbam-engine/,
  /emission-factor/,
  /components\/compliance/,
  /functions\/src\/cbam/,
];

const CBAM_UTILITY_FILES = [
  /uuid\.ts$/,
  /evidence-upload\.ts$/,
  /case-id\.ts$/,
  /case-summary\.ts$/,
  /new-case\.ts$/,
];

function isCbamFile(filename) {
  if (!filename) return false;
  if (CBAM_UTILITY_FILES.some(p => p.test(filename))) return false;
  return CBAM_FILE_PATTERNS.some(p => p.test(filename));
}

/** Require @euRef JSDoc on exported functions in CBAM paths. */
const requireEuRefRule = {
  meta: {
    type: "problem",
    docs: {
      description: "CBAM: Require @euRef JSDoc tag on exported calculation functions.",
      recommended: true,
    },
    messages: {
      missingEuRef: "CBAM: Function `{{name}}` is missing @euRef JSDoc. Must cite the EU regulation article/annex: `@euRef 'Implementing Regulation (EU) 2023/1773 Annex III.B'`.",
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename || context.getFilename?.() || "";

    /** Get all comments from node and its parent ExportNamedDeclaration */
    function getCommentsIncludingParent(node) {
      // Check comments on the node itself
      let comments = context.sourceCode.getCommentsBefore(node);
      let text = comments.map(c => c.value).join("\n");

      // Also check parent ExportNamedDeclaration (JSDoc often attaches to parent)
      if (node.parent && node.parent.type === "ExportNamedDeclaration") {
        const parentComments = context.sourceCode.getCommentsBefore(node.parent);
        if (parentComments.length > 0) {
          text = parentComments.map(c => c.value).join("\n") + "\n" + text;
        }
      }

      return text;
    }

    return {
      "ExportNamedDeclaration > FunctionDeclaration": (node) => {
        if (!isCbamFile(filename)) return;
        const name = node.id?.name || "anonymous";
        const allComments = getCommentsIncludingParent(node);
        if (!/@euRef/i.test(allComments)) {
          context.report({ node, messageId: "missingEuRef", data: { name } });
        }
      },
      "ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > ArrowFunctionExpression": (node) => {
        if (!isCbamFile(filename)) return;
        let name = "anonymous";
        let parent = node.parent;
        while (parent) {
          if (parent.id?.name) { name = parent.id.name; break; }
          if (parent.declarations?.[0]?.id?.name) { name = parent.declarations[0].id.name; break; }
          parent = parent.parent;
        }
        const declNode = node.parent?.parent;
        if (declNode) {
          // Check comments on the VariableDeclaration AND its ExportNamedDeclaration parent
          let allComments = context.sourceCode.getCommentsBefore(declNode).map(c => c.value).join("\n");
          if (declNode.parent?.type === "ExportNamedDeclaration") {
            allComments = context.sourceCode.getCommentsBefore(declNode.parent).map(c => c.value).join("\n") + "\n" + allComments;
          }
          if (!/@euRef/i.test(allComments)) {
            context.report({ node: declNode, messageId: "missingEuRef", data: { name } });
          }
        }
      },
    };
  },
};

/** Block float arithmetic in CBAM files. Big.js required. */
const noFloatArithmeticRule = {
  meta: {
    type: "problem",
    docs: {
      description: "CBAM: Block Number float arithmetic in calculation paths. Big.js required.",
      recommended: true,
    },
    messages: {
      floatMultiplication: "CBAM: Float multiplication (*) detected. Use `new Big(a).times(b)`. Exact precision required for EU compliance.",
      floatDivision: "CBAM: Float division (/) detected. Use `new Big(a).div(b)`. Rounding errors violate Annex III.",
      floatAddition: "CBAM: Float addition (+) detected. Use `new Big(a).plus(b)`. Accumulated error violates mass-balance (±0.01%).",
      floatSubtraction: "CBAM: Float subtraction (-) detected. Use `new Big(a).minus(b)`. Precision loss = regulatory non-compliance.",
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename || context.getFilename?.() || "";

    return {
      BinaryExpression: (node) => {
        if (!isCbamFile(filename)) return;

        // Skip string concatenation and template literal expressions
        if (typeof node.left?.value === "string" || typeof node.right?.value === "string") return;
        if (node.parent?.type === "TemplateLiteral") return;

        // Skip integer arithmetic (array indices, bit shifts, etc.)
        if (node.operator === "+") {
          const leftVal = node.left?.value;
          const rightVal = node.right?.value;
          if (typeof leftVal === "number" && Number.isInteger(leftVal) &&
              typeof rightVal === "number" && Number.isInteger(rightVal)) return;
        }

        const msgs = { "*": "floatMultiplication", "/": "floatDivision", "+": "floatAddition", "-": "floatSubtraction" };
        const msg = msgs[node.operator];
        if (msg) context.report({ node, messageId: msg });
      },
    };
  },
};

/** Block hardcoded numeric emission factors. */
const noHardcodedFactorRule = {
  meta: {
    type: "problem",
    docs: {
      description: "CBAM: Block hardcoded emission factors. Use @/lib/cbam/emission-factors registry.",
      recommended: true,
    },
    messages: {
      hardcodedFactor: "CBAM: Hardcoded emission factor `{{value}}` in `{{name}}`. Use `@/lib/cbam/emission-factors` registry. Values change with EU regulation updates.",
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename || context.getFilename?.() || "";

    return {
      VariableDeclarator: (node) => {
        if (!isCbamFile(filename)) return;
        if (!node.id || !node.init) return;
        const name = node.id.name?.toLowerCase() || "";
        if (!/emission|factor|benchmark|default/.test(name)) return;

        let value = null;
        if (node.init.type === "Literal" && typeof node.init.value === "number") {
          value = node.init.value;
        }

        if (value !== null && value !== 0 && value !== 1) {
          context.report({
            node,
            messageId: "hardcodedFactor",
            data: { value: String(value), name: node.id.name },
          });
        }
      },
    };
  },
};

// ─── Plugin definition ───

const plugin = {
  rules: {
    "require-eu-ref": requireEuRefRule,
    "no-float-arithmetic": noFloatArithmeticRule,
    "no-hardcoded-emission-factor": noHardcodedFactorRule,
  },
};

// Attach configs after plugin definition (flat config: plugins reference actual rules)
plugin.configs = {
  strict: {
    plugins: { "cbam-compliance": plugin },
    rules: {
      "cbam-compliance/require-eu-ref": "error",
      "cbam-compliance/no-float-arithmetic": "error",
      "cbam-compliance/no-hardcoded-emission-factor": "error",
    },
  },
  /** Apply only to CBAM calculation files (use alongside strict) */
  "cbam-files": {
    files: [
      "lib/cbam/calculation/**/*.ts",
      "lib/cbam-engine/**/*.ts",
      "lib/cbam/emission-factors/**/*.ts",
      "lib/cbam/schema.ts",
      "functions/src/cbam/**/*.ts",
      "components/compliance/**/*.tsx",
    ],
  },
};

export default plugin;
