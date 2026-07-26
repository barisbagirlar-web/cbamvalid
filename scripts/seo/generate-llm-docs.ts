import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildLlmDocModel, renderLlmsFullTxt, renderLlmsTxt } from "../../lib/seo/llm-doc-model";

const root = resolve(process.cwd());
const model = buildLlmDocModel();
const llms = renderLlmsTxt(model);
const full = renderLlmsFullTxt(model);

writeFileSync(resolve(root, "public/llms.txt"), llms, "utf8");
writeFileSync(resolve(root, "public/llm.txt"), llms, "utf8");
writeFileSync(resolve(root, "public/llms-full.txt"), full, "utf8");

console.log("Generated public/llms.txt, public/llm.txt, public/llms-full.txt from SEO SSOT");
