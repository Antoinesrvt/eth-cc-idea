import { createUnlink, unlinkAccount, unlinkEvm } from "@unlink-xyz/sdk";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

// Create Unlink client for a specific user (server-side only)
export function createUnlinkClient(userMnemonic: string) {
  const evmAccount = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);

  const walletClient = createWalletClient({
    account: evmAccount,
    chain: baseSepolia,
    transport: http(process.env.RPC_URL || "https://sepolia.base.org"),
  });

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.RPC_URL || "https://sepolia.base.org"),
  });

  return createUnlink({
    engineUrl: process.env.UNLINK_ENGINE_URL || "https://staging-api.unlink.xyz",
    apiKey: process.env.UNLINK_API_KEY!,
    account: unlinkAccount.fromMnemonic({ mnemonic: userMnemonic }),
    evm: unlinkEvm.fromViem({ walletClient, publicClient }),
  });
}

// Deposit USDC into shielded pool
export async function privateDeposit(userMnemonic: string, tokenAddress: string, amount: string) {
  const unlink = createUnlinkClient(userMnemonic);

  // Ensure ERC20 approval
  const approval = await unlink.ensureErc20Approval({ token: tokenAddress, amount });
  if (approval.status === "submitted") {
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(process.env.RPC_URL || "https://sepolia.base.org"),
    });
    await publicClient.waitForTransactionReceipt({ hash: approval.txHash as `0x${string}` });
  }

  return unlink.deposit({ token: tokenAddress, amount });
}

// Private transfer (milestone payout)
export async function privateTransfer(
  userMnemonic: string,
  recipientUnlinkAddr: string,
  tokenAddress: string,
  amount: string,
) {
  const unlink = createUnlinkClient(userMnemonic);
  return unlink.transfer({ recipientAddress: recipientUnlinkAddr, token: tokenAddress, amount });
}

// Withdraw from shielded pool to EVM address
export async function privateWithdraw(
  userMnemonic: string,
  recipientEvmAddress: string,
  tokenAddress: string,
  amount: string,
) {
  const unlink = createUnlinkClient(userMnemonic);
  return unlink.withdraw({ recipientEvmAddress, token: tokenAddress, amount });
}

export function isUnlinkConfigured(): boolean {
  return !!(process.env.UNLINK_API_KEY && process.env.EVM_PRIVATE_KEY);
}
