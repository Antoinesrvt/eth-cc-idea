import { CHAIN_CONFIG } from "./config";

export function isBlockchainConfigured(): boolean {
  return !!(
    CHAIN_CONFIG.deployerKey &&
    CHAIN_CONFIG.rpcUrl &&
    CHAIN_CONFIG.rpcUrl !== "http://localhost:8545"
  );
}
