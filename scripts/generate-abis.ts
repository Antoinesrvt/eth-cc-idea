import fs from "fs";
import path from "path";

/**
 * ABI generation script.
 *
 * Reads Foundry compiled artifacts from contracts/out/ and generates
 * typed TypeScript ABI exports in src/lib/blockchain/abis/.
 *
 * Run: npx tsx scripts/generate-abis.ts
 * (or: npm run generate:abis)
 */

// Map of Solidity contract name -> TypeScript export name.
// The export name follows the UPPER_SNAKE_CASE convention used by the existing codebase.
const CONTRACTS: Record<string, string> = {
  ServiceContract: "SERVICE_CONTRACT_ABI",
  ContractToken: "CONTRACT_TOKEN_ABI",
  ContractFactory: "CONTRACT_FACTORY_ABI",
  Marketplace: "MARKETPLACE_ABI",
  Attestation: "ATTESTATION_ABI",
  EscrowPublic: "ESCROW_PUBLIC_ABI",
  AgencyProfile: "AGENCY_PROFILE_ABI",
  ForeignGateway: "FOREIGN_GATEWAY_ABI",
  HomeGateway: "HOME_GATEWAY_ABI",
  DocumentStore: "DOCUMENT_STORE_ABI",
};

const OUT_DIR = path.resolve(__dirname, "../contracts/out");
const ABI_DIR = path.resolve(__dirname, "../src/lib/blockchain/abis");

// Check that contracts have been compiled
if (!fs.existsSync(OUT_DIR)) {
  console.error(
    "Error: contracts/out/ not found. Run 'npm run contracts:build' first.",
  );
  process.exit(1);
}

// Ensure output dir exists
fs.mkdirSync(ABI_DIR, { recursive: true });

let generated = 0;

for (const [name, exportName] of Object.entries(CONTRACTS)) {
  // Foundry outputs to out/{ContractName}.sol/{ContractName}.json
  const artifactPath = path.join(OUT_DIR, `${name}.sol`, `${name}.json`);

  if (!fs.existsSync(artifactPath)) {
    console.warn(`  SKIP  ${name} (artifact not found: ${artifactPath})`);
    continue;
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
  const abi = artifact.abi;

  if (!abi || !Array.isArray(abi)) {
    console.warn(`  SKIP  ${name} (no ABI in artifact)`);
    continue;
  }

  const tsContent = `// Auto-generated from contracts/src/${name}.sol -- DO NOT EDIT
// Regenerate with: npm run generate:abis

export const ${exportName} = ${JSON.stringify(abi, null, 2)} as const;
`;

  const outPath = path.join(ABI_DIR, `${name}.ts`);
  fs.writeFileSync(outPath, tsContent);
  console.log(`  OK    ${name}.ts -> ${exportName} (${abi.length} entries)`);
  generated++;
}

// Generate barrel export
const barrel =
  Object.entries(CONTRACTS)
    .map(([name, exportName]) => `export { ${exportName} } from "./${name}";`)
    .join("\n") + "\n";

fs.writeFileSync(path.join(ABI_DIR, "index.ts"), barrel);
console.log(`  OK    index.ts (barrel export)`);

console.log(`\nGenerated ${generated} ABI files.`);
