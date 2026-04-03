import { ethers } from "ethers";
import { getProvider, getDeployerSigner } from "./clients";

/**
 * Deposit native currency into the service contract escrow.
 */
export async function depositEscrow(
  contractAddress: string,
  amount: bigint,
): Promise<string> {
  if (!contractAddress || contractAddress === ethers.ZeroAddress) {
    throw new Error("Service contract address is not configured");
  }

  const signer = getDeployerSigner();
  const contract = new ethers.Contract(
    contractAddress,
    SERVICE_CONTRACT_ABI,
    signer,
  );

  // depositEscrow() uses ERC20 transferFrom — no value needed
  // The deployer must have approved the ServiceContract to spend tUSD first
  const tx = await contract.depositEscrow();
  const receipt = await tx.wait(1);
  return receipt.hash;
}

/**
 * Submit a deliverable proof hash for a specific milestone.
 */
export async function submitDeliverable(
  contractAddress: string,
  milestoneId: number,
  proofHash: string,
): Promise<string> {
  if (!contractAddress || contractAddress === ethers.ZeroAddress) {
    throw new Error("Service contract address is not configured");
  }

  const signer = getDeployerSigner();
  const contract = new ethers.Contract(
    contractAddress,
    SERVICE_CONTRACT_ABI,
    signer,
  );

  const proofBytes = ethers.zeroPadValue(
    ethers.toBeArray(ethers.id(proofHash)),
    32,
  );
  const tx = await contract.submitDeliverable(milestoneId, proofBytes);
  const receipt = await tx.wait(1);
  return receipt.hash;
}

/**
 * Approve a milestone, which triggers escrow release with fee split.
 */
export async function approveMilestone(
  contractAddress: string,
  milestoneId: number,
): Promise<string> {
  if (!contractAddress || contractAddress === ethers.ZeroAddress) {
    throw new Error("Service contract address is not configured");
  }

  const signer = getDeployerSigner();
  const contract = new ethers.Contract(
    contractAddress,
    SERVICE_CONTRACT_ABI,
    signer,
  );

  const tx = await contract.approveMilestone(milestoneId);
  const receipt = await tx.wait(1);
  return receipt.hash;
}

/**
 * Reject a delivered milestone, returning it to the agency for rework.
 */
export async function rejectMilestone(
  contractAddress: string,
  milestoneId: number,
  reason: string,
): Promise<string> {
  if (!contractAddress || contractAddress === ethers.ZeroAddress) {
    throw new Error("Service contract address is not configured");
  }

  const signer = getDeployerSigner();
  const contract = new ethers.Contract(
    contractAddress,
    SERVICE_CONTRACT_ABI,
    signer,
  );

  // Encode reason as bytes32 (hash the string if it's longer than 32 bytes)
  const reasonBytes = ethers.zeroPadValue(
    ethers.toBeArray(ethers.id(reason)),
    32,
  );

  const tx = await contract.rejectMilestone(milestoneId, reasonBytes);
  const receipt = await tx.wait(1);
  return receipt.hash;
}

/**
 * Refund a single failed or disputed milestone back to the client.
 * Only callable by client or platformTreasury.
 * @param contractAddress  ServiceContract address
 * @param milestoneId      Index of the milestone to refund
 */
export async function refundMilestone(
  contractAddress: string,
  milestoneId: number,
): Promise<string> {
  if (!contractAddress || contractAddress === ethers.ZeroAddress) {
    throw new Error("Service contract address is not configured");
  }

  const signer = getDeployerSigner();
  const contract = new ethers.Contract(
    contractAddress,
    SERVICE_CONTRACT_ABI,
    signer,
  );

  const tx = await contract.refundMilestone(milestoneId);
  const receipt = await tx.wait(1);
  return receipt.hash;
}

/**
 * Mark a contract as failed. Sets all non-approved milestones to Failed.
 * Only callable by client or platform operator.
 */
export async function markContractFailed(
  contractAddress: string,
): Promise<string> {
  if (!contractAddress || contractAddress === ethers.ZeroAddress) {
    throw new Error("Service contract address is not configured");
  }
  const signer = getDeployerSigner();
  const contract = new ethers.Contract(contractAddress, SERVICE_CONTRACT_ABI, signer);
  const tx = await contract.markFailed();
  const receipt = await tx.wait(1);
  return receipt.hash;
}

/**
 * Refund remaining escrow to client. Only callable when contract is Failed.
 */
export async function refundEscrow(
  contractAddress: string,
): Promise<string> {
  if (!contractAddress || contractAddress === ethers.ZeroAddress) {
    throw new Error("Service contract address is not configured");
  }
  const signer = getDeployerSigner();
  const contract = new ethers.Contract(contractAddress, SERVICE_CONTRACT_ABI, signer);
  const tx = await contract.refundEscrow();
  const receipt = await tx.wait(1);
  return receipt.hash;
}

/**
 * Read the full contract state from the on-chain ServiceContract.
 */
export async function getContractState(contractAddress: string): Promise<{
  client: string;
  agency: string;
  bd: string;
  totalValue: bigint;
  milestoneCount: number;
  tokenAddress: string;
}> {
  if (!contractAddress || contractAddress === ethers.ZeroAddress) {
    throw new Error("Service contract address is not configured");
  }

  const provider = getProvider();
  const contract = new ethers.Contract(
    contractAddress,
    SERVICE_CONTRACT_ABI,
    provider,
  );

  const [state, count, tokenAddr] = await Promise.all([
    contract.getContractData(),
    contract.milestoneCount(),
    contract.getTokenAddress(),
  ]);

  return {
    client: state.client,
    agency: state.agency,
    bd: state.bd,
    totalValue: state.totalValue,
    milestoneCount: Number(count),
    tokenAddress: tokenAddr,
  };
}
