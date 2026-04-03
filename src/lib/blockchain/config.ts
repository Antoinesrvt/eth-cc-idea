// Single-chain config — Base Sepolia (testnet) or Base (mainnet).

export const CHAIN_CONFIG = {
  chainId: parseInt(process.env.CHAIN_ID || "84532"),
  chainName: process.env.CHAIN_NAME || "Base Sepolia",
  rpcUrl: process.env.RPC_URL || "https://sepolia.base.org",
  explorerUrl: process.env.EXPLORER_URL || "https://sepolia.basescan.org",
  deployerKey: process.env.DEPLOYER_PRIVATE_KEY || process.env.EVM_PRIVATE_KEY || "",
  serviceContractAddress: process.env.SERVICE_CONTRACT_ADDRESS || "",
  platformTreasury: process.env.PLATFORM_TREASURY || "",
  paymentTokenAddress: process.env.PAYMENT_TOKEN_ADDRESS || "",
  // Uniswap V3 (Base Sepolia)
  uniswap: {
    factory: process.env.UNISWAP_FACTORY || "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24",
    router: process.env.UNISWAP_ROUTER || "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4",
    positionManager: process.env.UNISWAP_POSITION_MANAGER || "0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2",
  },
} as const;
