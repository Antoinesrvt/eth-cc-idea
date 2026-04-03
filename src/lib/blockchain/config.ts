// Single-chain config — Arbitrum Sepolia (testnet) or Arbitrum One (mainnet).
// Contract addresses are dynamic — set after deployment, stored in DB or passed at runtime.

export const CHAIN_CONFIG = {
  chainId: parseInt(process.env.CHAIN_ID || "421614"),
  rpcUrl: process.env.RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
  explorerUrl: process.env.EXPLORER_URL || "https://sepolia.arbiscan.io",
  deployerKey: process.env.DEPLOYER_PRIVATE_KEY || "",
  factoryAddress: process.env.CONTRACT_FACTORY_ADDRESS || "",
  attestationAddress: process.env.ATTESTATION_ADDRESS || "",
  agencyProfileAddress: process.env.AGENCY_PROFILE_ADDRESS || "",
  platformTreasury: process.env.PLATFORM_TREASURY || "",
  paymentTokenAddress: process.env.PAYMENT_TOKEN_ADDRESS || "",
} as const;
