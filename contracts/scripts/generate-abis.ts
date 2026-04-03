/**
 * Generate TypeScript ABI files from Foundry compilation output.
 * Run: npx tsx scripts/generate-abis.ts
 * Or:  npm run generate:abis
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CONTRACTS = [
  "ServiceContract",
  "ContractToken",
  "Marketplace",
  "Attestation",
  "EscrowPublic",
  "AgencyProfile",
  "ForeignGateway",
  "HomeGateway",
];

const OUT_DIR = path.resolve(__dirname, "../contracts/out");
const ABI_DIR = path.resolve(__dirname, "../src/lib/blockchain/abis");

if (!fs.existsSync(OUT_DIR)) {
  console.error("contracts/out/ not found. Run `npm run contracts:build` first.");
  process.exit(1);
}

fs.mkdirSync(ABI_DIR, { recursive: true });

let generated = 0;

for (const name of CONTRACTS) {
  const artifactPath = path.join(OUT_DIR, `${name}.sol`, `${name}.json`);

  if (!fs.existsSync(artifactPath)) {
    console.warn(`  ⚠ Skipped: ${name} (no artifact)`);
    continue;
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
  const abi = artifact.abi;

  const exportName = name.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase() + "_ABI";

  const content = `// Auto-generated from contracts/src/${name}.sol — DO NOT EDIT\n// Regenerate with: npm run generate:abis\n\nexport const ${exportName} = ${JSON.stringify(abi, null, 2)} as const;\n`;

  fs.writeFileSync(path.join(ABI_DIR, `${name}.ts`), content);
  console.log(`  ✓ ${name}.ts → ${exportName} (${abi.length} entries)`);
  generated++;
}

const barrel = CONTRACTS
  .filter((n) => fs.existsSync(path.join(ABI_DIR, `${n}.ts`)))
  .map((n) => {
    const exp = n.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase() + "_ABI";
    return `export { ${exp} } from "./${n}";`;
  })
  .join("\n") + "\n";

fs.writeFileSync(path.join(ABI_DIR, "index.ts"), `// Auto-generated barrel — DO NOT EDIT\n${barrel}`);
console.log(`\n  Done. Generated ${generated}/${CONTRACTS.length} ABIs.`);
