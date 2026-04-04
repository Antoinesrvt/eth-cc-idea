import { ethers } from "ethers";
import { CHAIN_CONFIG } from "./config";

let _provider: ethers.JsonRpcProvider | null = null;

export function getProvider(): ethers.JsonRpcProvider {
  if (!_provider) {
    // Pass explicit network to prevent ENS resolution attempts on local/unknown chains
    const network = new ethers.Network(CHAIN_CONFIG.chainName, CHAIN_CONFIG.chainId);
    _provider = new ethers.JsonRpcProvider(CHAIN_CONFIG.rpcUrl, network, { staticNetwork: network });
  }
  return _provider;
}

/** @deprecated Use getProvider() — single-chain config */
export const getPrivacyNodeProvider = getProvider;
/** @deprecated Use getProvider() — single-chain config */
export const getPublicChainProvider = getProvider;

export function getDeployerSigner(
  provider?: ethers.JsonRpcProvider,
): ethers.Wallet {
  const p = provider || getProvider();
  return new ethers.Wallet(CHAIN_CONFIG.deployerKey, p);
}
