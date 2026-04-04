import { ethers } from "ethers";
import { CHAIN_CONFIG } from "./config";

export function isBlockchainConfigured(): boolean {
  return !!(CHAIN_CONFIG.deployerKey && CHAIN_CONFIG.rpcUrl);
}

const ERC20_DECIMALS_ABI = ["function decimals() view returns (uint8)"];

/**
 * Query the decimals of an ERC20 token on-chain.
 * Defaults to 18 if the call fails (non-standard token).
 */
export async function getTokenDecimals(
  tokenAddress: string,
  provider: ethers.Provider,
): Promise<number> {
  try {
    const token = new ethers.Contract(tokenAddress, ERC20_DECIMALS_ABI, provider);
    return Number(await token.decimals());
  } catch {
    console.warn(`[getTokenDecimals] Failed to query decimals for ${tokenAddress}, defaulting to 18`);
    return 18;
  }
}
