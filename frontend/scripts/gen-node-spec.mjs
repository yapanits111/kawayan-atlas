// Regenerates the node reference in docs/NODE-SPEC.md from the live registry
// (whitepaper §15). Prose above "## Node reference" is hand-written and preserved.
//
//   cd frontend && node scripts/gen-node-spec.mjs

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontend = path.resolve(here, "..");
const docPath = path.resolve(frontend, "..", "docs", "NODE-SPEC.md");
// Compile inside node_modules so `three` still resolves from the output directory.
const outDir = path.join(frontend, "node_modules", ".cache", "kawayan-nodespec");

const sources = ["types", "geometry", "nodeDefs"].map((f) =>
  path.join("src", "lib", "design", `${f}.ts`),
);

const require = createRequire(import.meta.url);
// Run the compiler through Node rather than the `tsc`/`npx` shim: spawning a .cmd
// without a shell is EINVAL on current Node for Windows.
execFileSync(
  process.execPath,
  [require.resolve("typescript/bin/tsc"), ...sources, "--outDir", outDir,
   "--module", "commonjs", "--target", "es2020",
   "--moduleResolution", "node", "--skipLibCheck", "--esModuleInterop"],
  { cwd: frontend, stdio: "inherit" },
);

const { NODE_DEFS, CATEGORIES } = require(path.join(outDir, "nodeDefs.js"));

const DYNAMIC_SOURCE = {
  species: "from the species atlas",
  joints: "from the joint library",
};

const io = (ports) =>
  ports.length ? ports.map((p) => `\`${p.id}\` ${p.label} *(${p.kind})*`).join(" · ") : "—";

const out = [];
for (const cat of CATEGORIES) {
  out.push(`\n### ${cat}\n`);
  for (const d of Object.values(NODE_DEFS).filter((x) => x.category === cat)) {
    out.push(`#### \`${d.type}\` — ${d.label}\n`);
    out.push(`| | |`, `|---|---|`);
    out.push(`| **Inputs** | ${io(d.inputs)} |`);
    out.push(`| **Outputs** | ${io(d.outputs)} |`);
    if (d.params.length) {
      out.push(`\n| Param | Label | Default | Range |`, `|---|---|---|---|`);
      for (const p of d.params) {
        const range = p.options
          ? p.options.map((o) => `\`${o}\``).join(" / ")
          : p.dynamic
            ? DYNAMIC_SOURCE[p.dynamic] ?? `from the ${p.dynamic} API`
            : [p.min !== undefined ? `min ${p.min}` : null, p.max !== undefined ? `max ${p.max}` : null]
                .filter(Boolean)
                .join(", ") || "—";
        out.push(`| **${p.key}** | ${p.label} | \`${p.default === "" ? "(none)" : p.default}\` | ${range} |`);
      }
    } else {
      out.push(`\n*No parameters.*`);
    }
    out.push("");
  }
}

const START = "## Node reference";
const END = "\n---\n\n## Regenerating";
const CRLF = String.fromCharCode(13, 10);
// Normalise line endings before matching: an editor (or a Windows tool) may have
// rewritten the file as CRLF, which would hide the markers.
const doc = fs.readFileSync(docPath, "utf8").split(CRLF).join("\n");
const s = doc.indexOf(START);
const e = doc.indexOf(END);
if (s === -1 || e === -1 || e < s) {
  throw new Error(`Could not find the "${START}" / "## Regenerating" markers in ${docPath}`);
}
fs.writeFileSync(docPath, doc.slice(0, s + START.length) + "\n" + out.join("\n") + doc.slice(e), "utf8");
console.log(`Wrote ${Object.keys(NODE_DEFS).length} nodes to ${path.relative(process.cwd(), docPath)}`);
