// Chain config — switches based on ENV variable
// ENV=local   → Anvil fork (localhost:8545)
// ENV=testnet → Base Sepolia
// ENV=mainnet → Base

type Environment = "local" | "testnet" | "mainnet";

const ENV = (process.env.ENV || "local") as Environment;

const CHAIN_PRESETS: Record<Environment, {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
}> = {
  local: {
    chainId: 31337,
    name: "Anvil (Local)",
    rpcUrl: "http://localhost:8545",
    explorerUrl: "http://localhost:8545",
  },
  testnet: {
    chainId: 84532,
    name: "Base Sepolia",
    rpcUrl: "https://sepolia.base.org",
    explorerUrl: "https://sepolia.basescan.org",
  },
  mainnet: {
    chainId: 8453,
    name: "Base",
    rpcUrl: "https://mainnet.base.org",
    explorerUrl: "https://basescan.org",
  },
};

const preset = CHAIN_PRESETS[ENV];

export const CHAIN_CONFIG = {
  env: ENV,
  chainId: parseInt(process.env.CHAIN_ID || String(preset.chainId)),
  chainName: process.env.CHAIN_NAME || preset.name,
  rpcUrl: process.env.RPC_URL || preset.rpcUrl,
  explorerUrl: process.env.EXPLORER_URL || preset.explorerUrl,
  isLocal: ENV === "local",
  isTestnet: ENV === "testnet",
  isMainnet: ENV === "mainnet",

  // Wallet
  deployerKey: process.env.DEPLOYER_PRIVATE_KEY || process.env.EVM_PRIVATE_KEY || "",
  platformTreasury: process.env.PLATFORM_TREASURY || "",

  // Contracts
  serviceContractAddress: process.env.SERVICE_CONTRACT_ADDRESS || "",
  paymentTokenAddress: process.env.PAYMENT_TOKEN_ADDRESS || "",

  // Uniswap V3 (same on Base Sepolia + local fork)
  uniswap: {
    factory: process.env.UNISWAP_FACTORY || "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24",
    router: process.env.UNISWAP_ROUTER || "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4",
    positionManager: process.env.UNISWAP_POSITION_MANAGER || "0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2",
  },
} as const;

export type { Environment };
