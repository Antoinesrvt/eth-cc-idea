# Integration Guide — ETHGlobal Cannes 2026

## Track 1: Arc (Circle) — USDC Escrow

**What:** ServiceContract accepts USDC for milestone-based escrow.

**Already done:** ServiceContract uses `SafeERC20.safeTransferFrom` — works with any ERC20 including USDC.

**To do:**
- Set `PAYMENT_TOKEN_ADDRESS` to USDC on Arbitrum Sepolia: `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`
- Deploy ServiceContract with USDC as payment token
- Update deposit page to approve USDC before deposit

**USDC Addresses:**
- Arbitrum One: `0xaf88d065e77c8cC2239327C5EDb3A432268e5831`
- Arbitrum Sepolia: `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`

---

## Track 2: Unlink — Private Payments (ZKP)

**What:** Client deposits and milestone payouts are private on-chain.

**Package:**
```bash
pnpm add @unlink-xyz/sdk viem
```

**Chain:** Base Sepolia (Unlink testnet)

**Architecture:**
- SDK runs on backend (not client-side)
- One mnemonic per user (stored in DB)
- API key shared across all users

**Initialization:**
```typescript
import { createUnlink, unlinkAccount, unlinkEvm } from "@unlink-xyz/sdk";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const unlink = createUnlink({
  engineUrl: "https://staging-api.unlink.xyz",
  apiKey: process.env.UNLINK_API_KEY!,
  account: unlinkAccount.fromMnemonic({ mnemonic: userMnemonic }),
  evm: unlinkEvm.fromViem({ walletClient, publicClient }),
});
```

**Flow:**
```
1. Client deposits USDC into Unlink pool:
   await unlink.deposit({ token: USDC, amount })

2. Milestone approved → private transfer to agency:
   await unlink.transfer({ recipientAddress: agencyUnlinkAddr, token: USDC, amount })

3. Agency withdraws to their wallet:
   await unlink.withdraw({ recipientEvmAddress: agencyWallet, token: USDC, amount })
```

**What to build:**
- `src/lib/privacy/unlink.ts` — Unlink client wrapper
- `src/lib/privacy/accounts.ts` — Per-user mnemonic management
- Update deposit API route to use Unlink deposit
- Update approve API route to use Unlink transfer
- Add `unlink_mnemonic` column to users table

**Env vars:**
```
UNLINK_API_KEY=
UNLINK_ENGINE_URL=https://staging-api.unlink.xyz
```

**Note:** Unlink runs on Base Sepolia. This means we may need to be on Base Sepolia for this track, not Arbitrum Sepolia. OR we can have USDC escrow on Arbitrum and Unlink privacy on Base — but that adds bridge complexity. Simplest: deploy everything on Base Sepolia.

---

## Track 3: Uniswap — Token Marketplace

**What:** When agency tokenizes a contract, create a Uniswap V3 pool for the contract token.

**Packages:**
```bash
pnpm add @uniswap/v3-sdk @uniswap/sdk-core
```

**Flow:**
```
1. Agency tokenizes → deploy ContractToken (ERC20)
2. Create Uniswap V3 pool: ContractToken/USDC
3. Agency adds initial liquidity (their tokens + some USDC)
4. Investors swap USDC → ContractToken on Uniswap
5. Investors swap back ContractToken → USDC to exit
```

**What to build:**
- `src/lib/uniswap/pool.ts` — Create pool, add liquidity
- `src/lib/uniswap/swap.ts` — Swap via Uniswap router
- Re-add ContractToken.sol (simple ERC20, we deleted it earlier — need it for Uniswap pools)
- Update tokenize API route to create pool
- Update marketplace page to show Uniswap pools instead of custom listings

**Uniswap V3 Addresses (Arbitrum Sepolia):**
- Router: check Uniswap docs for testnet deployments
- Factory: check Uniswap docs

**Note:** Uniswap V3 may not be deployed on Base Sepolia. Need to verify. If not, we deploy on Arbitrum Sepolia where Uniswap exists, and skip Unlink (or figure out cross-chain).

---

## Chain Decision: Base Sepolia vs Arbitrum Sepolia

| Feature | Base Sepolia | Arbitrum Sepolia |
|---|---|---|
| Unlink | ✅ Supported | ❌ Not confirmed |
| Uniswap V3 | ❓ Need to check | ✅ Deployed |
| Kleros | ❌ Not on Base | ✅ Native |
| USDC | ✅ Available | ✅ Available |

**Options:**
1. **Base Sepolia** — Unlink works, need to check Uniswap, no Kleros
2. **Arbitrum Sepolia** — Uniswap + Kleros work, no Unlink
3. **Both** — Unlink on Base, Uniswap on Arbitrum (adds bridge complexity)

**Action needed:** Check with Unlink team if they support Arbitrum Sepolia. If yes → Arbitrum for everything. If no → evaluate tradeoffs.

---

## Implementation Order

1. **Validate chain** — confirm Unlink chain support
2. **Deploy ServiceContract** on target testnet with USDC
3. **Integrate Unlink** — deposit/transfer/withdraw wrappers
4. **Re-add ContractToken** — simple ERC20 for Uniswap pools
5. **Integrate Uniswap** — pool creation on tokenize, swap on buy
6. **Wire Kleros** — dispute court (if on Arbitrum)
7. **Polish UI** — update pages for new flows
