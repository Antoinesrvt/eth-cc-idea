import { ethers } from "ethers";
import { CHAIN_CONFIG } from "@/lib/blockchain/config";

// Fee tier: 0.3% (most common for volatile pairs)
export const DEFAULT_FEE_TIER = 3000;

// Tick spacing for 0.3% fee tier
const TICK_SPACING = 60;

// Min/max ticks for the full range position
const MIN_TICK = -887220; // Math.ceil(-887272 / 60) * 60
const MAX_TICK = 887220;  // Math.floor(887272 / 60) * 60

const POSITION_MANAGER_ABI = [
  "function createAndInitializePoolIfNecessary(address token0, address token1, uint24 fee, uint160 sqrtPriceX96) external payable returns (address pool)",
  "function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
];

const FACTORY_ABI = [
  "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)",
];

const POOL_ABI = [
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
  "function liquidity() external view returns (uint128)",
];

/**
 * Compute sqrtPriceX96 from a price ratio.
 * price = amount of token1 per token0 (both in their native decimals).
 * sqrtPriceX96 = sqrt(price) * 2^96
 */
function encodeSqrtPriceX96(
  price: number,
  token0Decimals: number,
  token1Decimals: number,
): bigint {
  // Adjust price for decimal difference
  const decimalAdjusted = price * Math.pow(10, token1Decimals - token0Decimals);
  const sqrtPrice = Math.sqrt(decimalAdjusted);
  // sqrtPriceX96 = sqrtPrice * 2^96
  const Q96 = BigInt(2) ** BigInt(96);
  // Use high precision integer math
  const sqrtPriceX96 = BigInt(Math.floor(sqrtPrice * 1e18)) * Q96 / BigInt(1e18);
  return sqrtPriceX96;
}

/**
 * Ensure the signer has approved the position manager to spend tokens.
 */
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
 * Get existing pool address (returns ZeroAddress if not yet created).
 */
export async function getPoolAddress(
  tokenAddress: string,
  usdcAddress: string,
  provider: ethers.Provider,
  feeTier: number = DEFAULT_FEE_TIER,
): Promise<string> {
  try {
    const factory = new ethers.Contract(
      CHAIN_CONFIG.uniswap.factory,
      FACTORY_ABI,
      provider,
    );
    const poolAddress: string = await factory.getPool(tokenAddress, usdcAddress, feeTier);
    return poolAddress;
  } catch {
    return ethers.ZeroAddress;
  }
}

/**
 * Get pool info (sqrtPriceX96, tick, liquidity) for an existing pool.
 */
export async function getPoolInfo(
  poolAddress: string,
  provider: ethers.Provider,
): Promise<{ sqrtPriceX96: bigint; tick: number; liquidity: bigint } | null> {
  try {
    if (!poolAddress || poolAddress === ethers.ZeroAddress) return null;
    const pool = new ethers.Contract(poolAddress, POOL_ABI, provider);
    const [slot0, liquidity] = await Promise.all([
      pool.slot0(),
      pool.liquidity(),
    ]);
    return {
      sqrtPriceX96: slot0.sqrtPriceX96,
      tick: Number(slot0.tick),
      liquidity: liquidity,
    };
  } catch {
    return null;
  }
}

/**
 * Create a Uniswap V3 pool for ContractToken/USDC and optionally initialize it.
 * Returns the pool address.
 */
export async function createPool(params: {
  tokenAddress: string;
  usdcAddress: string;
  initialPrice: number; // price in USDC per token (e.g., 0.90 means 1 token = 0.90 USDC)
  signer: ethers.Signer;
}): Promise<string> {
  const { tokenAddress, usdcAddress, initialPrice, signer } = params;
  const positionManager = new ethers.Contract(
    CHAIN_CONFIG.uniswap.positionManager,
    POSITION_MANAGER_ABI,
    signer,
  );

  // Uniswap requires token0 < token1 (lexicographic by address)
  const [token0, token1] = tokenAddress.toLowerCase() < usdcAddress.toLowerCase()
    ? [tokenAddress, usdcAddress]
    : [usdcAddress, tokenAddress];

  // Fetch decimals for both tokens
  const provider = signer.provider!;
  const token0Contract = new ethers.Contract(token0, ERC20_ABI, provider);
  const token1Contract = new ethers.Contract(token1, ERC20_ABI, provider);
  const [token0Decimals, token1Decimals]: [number, number] = await Promise.all([
    token0Contract.decimals().then(Number).catch(() => 18),
    token1Contract.decimals().then(Number).catch(() => 6),
  ]);

  // Price is expressed as token1 per token0
  // If token0 is contractToken: price = USDC per contractToken = initialPrice
  // If token0 is USDC: price = contractToken per USDC = 1 / initialPrice
  const priceToken0PerToken1 = token0.toLowerCase() === tokenAddress.toLowerCase()
    ? initialPrice
    : 1 / initialPrice;

  const sqrtPriceX96 = encodeSqrtPriceX96(priceToken0PerToken1, token0Decimals, token1Decimals);

  const tx = await positionManager.createAndInitializePoolIfNecessary(
    token0,
    token1,
    DEFAULT_FEE_TIER,
    sqrtPriceX96,
    { gasLimit: 500_000 },
  );
  const receipt = await tx.wait(1);

  // Extract pool address from return value or fetch from factory
  const factory = new ethers.Contract(CHAIN_CONFIG.uniswap.factory, FACTORY_ABI, provider);
  const poolAddress: string = await factory.getPool(token0, token1, DEFAULT_FEE_TIER);

  console.log(`[uniswap] Pool created: ${poolAddress} (tx: ${receipt.hash})`);
  return poolAddress;
}

/**
 * Add initial liquidity to a ContractToken/USDC Uniswap V3 pool.
 * Uses full-range position (min tick to max tick).
 * Returns the NFT position token ID as a string.
 */
export async function addLiquidity(params: {
  tokenAddress: string;
  usdcAddress: string;
  tokenAmount: bigint;
  usdcAmount: bigint;
  signer: ethers.Signer;
}): Promise<string> {
  const { tokenAddress, usdcAddress, tokenAmount, usdcAmount, signer } = params;
  const positionManagerAddress = CHAIN_CONFIG.uniswap.positionManager;

  // Uniswap requires token0 < token1
  const isTokenFirst = tokenAddress.toLowerCase() < usdcAddress.toLowerCase();
  const [token0, token1] = isTokenFirst
    ? [tokenAddress, usdcAddress]
    : [usdcAddress, tokenAddress];
  const [amount0Desired, amount1Desired] = isTokenFirst
    ? [tokenAmount, usdcAmount]
    : [usdcAmount, tokenAmount];

  // Approve position manager for both tokens
  await Promise.all([
    ensureApproval(tokenAddress, positionManagerAddress, tokenAmount, signer),
    ensureApproval(usdcAddress, positionManagerAddress, usdcAmount, signer),
  ]);

  const positionManager = new ethers.Contract(
    positionManagerAddress,
    POSITION_MANAGER_ABI,
    signer,
  );

  const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour
  const recipientAddress = await signer.getAddress();

  const mintParams = {
    token0,
    token1,
    fee: DEFAULT_FEE_TIER,
    tickLower: MIN_TICK,
    tickUpper: MAX_TICK,
    amount0Desired,
    amount1Desired,
    amount0Min: BigInt(0),
    amount1Min: BigInt(0),
    recipient: recipientAddress,
    deadline,
  };

  const tx = await positionManager.mint(mintParams, { gasLimit: 700_000 });
  const receipt = await tx.wait(1);

  // Parse tokenId from logs (Transfer event: from=0, to=recipient, tokenId)
  let tokenId = "0";
  for (const log of receipt.logs) {
    // ERC721 Transfer topic: Transfer(address indexed from, address indexed to, uint256 indexed tokenId)
    if (
      log.topics.length === 4 &&
      log.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" &&
      log.topics[1] === ethers.zeroPadValue(ethers.ZeroAddress, 32)
    ) {
      tokenId = BigInt(log.topics[3]).toString();
      break;
    }
  }

  console.log(`[uniswap] Liquidity added, position tokenId: ${tokenId} (tx: ${receipt.hash})`);
  return tokenId;
}
