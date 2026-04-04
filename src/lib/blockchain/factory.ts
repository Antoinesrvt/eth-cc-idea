import { ethers } from "ethers";
import { CHAIN_CONFIG } from "./config";
import { getDeployerSigner } from "./clients";

// Minimal ABI for ContractFactory.createDeal
const FACTORY_ABI = [
  "function createDeal(address client, address agency, address bd, uint16 bdFeeBps, bytes32 termsHash, string[] milestoneNames, uint256[] milestoneAmounts, uint256[] milestoneDeadlines, string tokenName, string tokenSymbol) external returns (address serviceContract, address token)",
  "event DealCreated(uint256 indexed dealId, address indexed serviceContract, address indexed token)",
];

export interface CreateDealParams {
  client: string;
  agency: string;
  bd?: string;
  bdFeeBps: number;
  termsHash: string;
  milestones: { name: string; amount: bigint; deadline: number }[];
  tokenName: string;
  tokenSymbol: string;
}

export async function createDeal(params: CreateDealParams): Promise<{
  serviceContractAddress: string;
  tokenAddress: string;
  txHash: string;
}> {
  const factoryAddress = CHAIN_CONFIG.factoryAddress;
  if (!factoryAddress) throw new Error("CONTRACT_FACTORY_ADDRESS not configured");

  const signer = getDeployerSigner();
  const factory = new ethers.Contract(factoryAddress, FACTORY_ABI, signer);

  const names = params.milestones.map(m => m.name);
  const amounts = params.milestones.map(m => m.amount);
  const deadlines = params.milestones.map(m => m.deadline);

  const tx = await factory.createDeal(
    params.client,
    params.agency,
    params.bd || ethers.ZeroAddress,
    params.bdFeeBps,
    ethers.id(params.termsHash),
    names,
    amounts,
    deadlines,
    params.tokenName,
    params.tokenSymbol,
  );

  const receipt = await tx.wait(1);

  // Extract addresses from DealCreated event
  const iface = new ethers.Interface(FACTORY_ABI);
  const dealEvent = receipt.logs
    .map((log: ethers.Log) => { try { return iface.parseLog(log); } catch { return null; } })
    .find((e: ethers.LogDescription | null) => e?.name === "DealCreated");

  return {
    serviceContractAddress: dealEvent?.args?.serviceContract || ethers.ZeroAddress,
    tokenAddress: dealEvent?.args?.token || ethers.ZeroAddress,
    txHash: receipt.hash,
  };
}

export function isFactoryConfigured(): boolean {
  return !!CHAIN_CONFIG.factoryAddress && !!CHAIN_CONFIG.deployerKey;
}
