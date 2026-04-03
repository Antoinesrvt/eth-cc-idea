import { ethers } from "ethers";
import { CHAIN_CONFIG } from "@/lib/blockchain/config";
import { DEFAULT_FEE_TIER } from "./pool";

const ROUTER_ABI = [
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)",
  "function exactOutputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountIn)",
];

const QUOTER_ABI = [
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
];

// Uniswap V3 Quoter V2 on Base Sepolia
const QUOTER_ADDRESS = "0xC5290058841028F1614F3A6F0F5816cAd0df5E27";

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
];

async function ensureApproval(
  tokenAddress: string,
  spender: string,
  amount: bigint,
  signer: ethers.Signer,
): Promise<void> {
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
  const ownerAddress = await signer.getAddress();
  const allowance: bigint = await token.allowance(ownerAddress, spender);
  if (allowance < amount) {
    const tx = await token.approve(spender, ethers.MaxUint256);
    await tx.wait(1);
  }
}

/**
 * Swap USDC → ContractToken (investor buys tokens).
 * @param params.usdcAmount  Amount of USDC to spend (in USDC base units, e.g. 1e6 = 1 USDC)
 * @returns transaction hash
 */
export async function buyTokens(params: {
  tokenAddress: string;
  usdcAddress: string;
  usdcAmount: bigint;
  slippageBps?: number; // default 50 bps = 0.5%
  signer: ethers.Signer;
}): Promise<string> {
  const { tokenAddress, usdcAddress, usdcAmount, slippageBps = 50, signer } = params;
  const routerAddress = CHAIN_CONFIG.uniswap.router;

  // Approve router to spend USDC
  await ensureApproval(usdcAddress, routerAddress, usdcAmount, signer);

  const router = new ethers.Contract(routerAddress, ROUTER_ABI, signer);
  const recipientAddress = await signer.getAddress();
  const deadline = Math.floor(Date.now() / 1000) + 1800; // 30 min

  // amountOutMinimum = 0 for hackathon (no MEV risk in testnet)
  const swapParams = {
    tokenIn: usdcAddress,
    tokenOut: tokenAddress,
    fee: DEFAULT_FEE_TIER,
    recipient: recipientAddress,
    amountIn: usdcAmount,
    amountOutMinimum: BigInt(0),
    sqrtPriceLimitX96: BigInt(0),
  };

  const tx = await router.exactInputSingle(swapParams, { gasLimit: 300_000 });
  const receipt = await tx.wait(1);
  console.log(`[uniswap] Bought tokens: ${usdcAmount} USDC → ContractToken (tx: ${receipt.hash})`);
  return receipt.hash as string;
}

/**
 * Swap ContractToken → USDC (investor sells tokens).
 * @param params.tokenAmount  Amount of ContractToken to sell (in 18-decimal units)
 * @returns transaction hash
 */
export async function sellTokens(params: {
  tokenAddress: string;
  usdcAddress: string;
  tokenAmount: bigint;
  slippageBps?: number; // default 50 bps = 0.5%
  signer: ethers.Signer;
}): Promise<string> {
  const { tokenAddress, usdcAddress, tokenAmount, signer } = params;
  const routerAddress = CHAIN_CONFIG.uniswap.router;

  // Approve router to spend ContractToken
  await ensureApproval(tokenAddress, routerAddress, tokenAmount, signer);

  const router = new ethers.Contract(routerAddress, ROUTER_ABI, signer);
  const recipientAddress = await signer.getAddress();

  const swapParams = {
    tokenIn: tokenAddress,
    tokenOut: usdcAddress,
    fee: DEFAULT_FEE_TIER,
    recipient: recipientAddress,
    amountIn: tokenAmount,
    amountOutMinimum: BigInt(0),
    sqrtPriceLimitX96: BigInt(0),
  };

  const tx = await router.exactInputSingle(swapParams, { gasLimit: 300_000 });
  const receipt = await tx.wait(1);
  console.log(`[uniswap] Sold tokens: ${tokenAmount} ContractToken → USDC (tx: ${receipt.hash})`);
  return receipt.hash as string;
}

/**
 * Get a quote for a swap using Uniswap V3 Quoter V2.
 * @param params.tokenIn   Input token address
 * @param params.tokenOut  Output token address
 * @param params.amount    Amount of tokenIn (in token's base units)
 * @returns Expected output amount (in tokenOut's base units), or 0n if quote fails
 */
export async function getQuote(params: {
  tokenIn: string;
  tokenOut: string;
  amount: bigint;
  provider: ethers.Provider;
}): Promise<bigint> {
  const { tokenIn, tokenOut, amount, provider } = params;
  try {
    const quoter = new ethers.Contract(QUOTER_ADDRESS, QUOTER_ABI, provider);
    const quoteParams = {
      tokenIn,
      tokenOut,
      amountIn: amount,
      fee: DEFAULT_FEE_TIER,
      sqrtPriceLimitX96: BigInt(0),
    };
    const [amountOut] = await quoter.quoteExactInputSingle.staticCall(quoteParams);
    return amountOut as bigint;
  } catch (err) {
    console.warn("[uniswap] getQuote failed:", err instanceof Error ? err.message : err);
    return BigInt(0);
  }
}
