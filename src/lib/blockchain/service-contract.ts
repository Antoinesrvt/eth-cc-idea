import { ethers } from "ethers";
import { getProvider, getDeployerSigner } from "./clients";
import { CHAIN_CONFIG } from "./config";
import { SERVICE_CONTRACT_ABI } from "./abis";

const MAX_GAS_LIMIT = 1_000_000;

/**
 * Estimate gas for a contract call, adding a 30% buffer.
 * Capped at MAX_GAS_LIMIT to prevent runaway gas.
 */
async function estimateGasWithBuffer(
  contract: ethers.Contract,
  method: string,
  args: unknown[] = [],
): Promise<bigint> {
  try {
    const estimated = await contract[method].estimateGas(...args);
    const buffered = (estimated * BigInt(130)) / BigInt(100);
    return buffered > BigInt(MAX_GAS_LIMIT) ? BigInt(MAX_GAS_LIMIT) : buffered;
  } catch {
    // Fallback if estimation fails
    return BigInt(MAX_GAS_LIMIT);
  }
}

/**
 * Deposit USDC into the service contract escrow.
 * Handles ERC20 approval automatically before calling depositEscrow().
 */
export async function depositEscrow(
  contractAddress: string,
  amount: bigint,
): Promise<string> {
  if (!contractAddress || contractAddress === ethers.ZeroAddress) {
    throw new Error("Service contract address is not configured");
  }

  const signer = getDeployerSigner();
  const signerAddress = await signer.getAddress();

  // 1. Check deployer USDC balance
  const paymentTokenAddress = CHAIN_CONFIG.paymentTokenAddress;
  if (!paymentTokenAddress) {
    throw new Error("PAYMENT_TOKEN_ADDRESS not configured");
  }

  const erc20Abi = [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address,address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)",
    "function decimals() view returns (uint8)",
  ];
  const paymentToken = new ethers.Contract(paymentTokenAddress, erc20Abi, signer);

  const balance: bigint = await paymentToken.balanceOf(signerAddress);
  if (balance < amount) {
    const decimals: number = await paymentToken.decimals().then(Number);
    const needed = ethers.formatUnits(amount, decimals);
    const has = ethers.formatUnits(balance, decimals);
    throw new Error(`Insufficient USDC balance: need ${needed}, have ${has}`);
  }

  // 2. Approve ServiceContract to spend USDC if needed
  const allowance: bigint = await paymentToken.allowance(signerAddress, contractAddress);
  if (allowance < amount) {
    console.log("[depositEscrow] Approving USDC spend...");
    const approveTx = await paymentToken.approve(contractAddress, ethers.MaxUint256);
    await approveTx.wait(1);
    console.log("[depositEscrow] USDC approved");
  }

  // 3. Call depositEscrow() — transfers full totalValue from signer to contract
  //    Use a fresh signer to avoid stale nonce cache after the approve tx above.
  const freshSigner = getDeployerSigner();
  const contract = new ethers.Contract(
    contractAddress,
    SERVICE_CONTRACT_ABI,
    freshSigner,
  );

  const gasLimit = await estimateGasWithBuffer(contract, "depositEscrow");
  const tx = await contract.depositEscrow({ gasLimit });
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
  const gasLimit = await estimateGasWithBuffer(contract, "submitDeliverable", [milestoneId, proofBytes]);
  const tx = await contract.submitDeliverable(milestoneId, proofBytes, { gasLimit });
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

  const gasLimit = await estimateGasWithBuffer(contract, "approveMilestone", [milestoneId]);
  const tx = await contract.approveMilestone(milestoneId, { gasLimit });
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

  const gasLimit = await estimateGasWithBuffer(contract, "rejectMilestone", [milestoneId, reasonBytes]);
  const tx = await contract.rejectMilestone(milestoneId, reasonBytes, { gasLimit });
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

  const gasLimit = await estimateGasWithBuffer(contract, "refundMilestone", [milestoneId]);
  const tx = await contract.refundMilestone(milestoneId, { gasLimit });
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
  const gasLimit = await estimateGasWithBuffer(contract, "markFailed");
  const tx = await contract.markFailed({ gasLimit });
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
  const gasLimit = await estimateGasWithBuffer(contract, "refundEscrow");
  const tx = await contract.refundEscrow({ gasLimit });
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
