# TrustSignal — Architecture

## Single-Chain Model (Base Sepolia)

TrustSignal currently runs on **Base Sepolia** (local dev: Anvil fork at `localhost:8545`). The Anvil fork inherits all deployed contracts from Base Sepolia, including Uniswap V3.

```
┌─────────────────────────────────────────────────────┐
│  BASE SEPOLIA (Chain 84532) / Anvil fork (31337)    │
│                                                     │
│  ContractFactory (singleton)                        │
│    └── createDeal() deploys per-deal:               │
│                                                     │
│  ServiceContract (per-deal orchestrator)             │
│    ├── Escrow: client deposits USDC                 │
│    ├── Milestones: state machine                    │
│    ├── Fee splits: platform + BD + agency           │
│    └── Controls ContractToken minting               │
│                                                     │
│  ContractToken (per-deal ERC20)                     │
│    └── Traded on Uniswap V3 after tokenization      │
│                                                     │
│  Uniswap V3 (from Base Sepolia)                     │
│    ├── Factory: 0x4752ba5DBc23f44D87826276BF6Fd6b1C │
│    ├── Router:  0x94cC0AaC535CCDB3C01d678...         │
│    └── NonfungiblePositionManager: 0x27F971cb...     │
│                                                     │
│  Test USDC (ContractToken deployed as tUSDC)         │
│    └── Minted by deploy script for testing           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Data Placement

| Data | Where | Why |
|---|---|---|
| Contract terms, milestones, deadlines | DB (Postgres) | Fast reads for UI |
| Client identity (name, address) | DB only | **NEVER exposed to investors** |
| Escrow (client's USDC) | On-chain (ServiceContract) | Trustless custody |
| Deliverable proofs | DB + on-chain hash | Proof of submission |
| ContractToken (ERC20) | On-chain | Deployed by factory, traded on Uniswap |
| Token marketplace | Uniswap V3 pools | Real AMM liquidity |
| Agency reputation | DB (agencyProfiles table) | Not yet on-chain |
| Disputes | DB | Kleros not yet wired (requires Arbitrum) |

## The Complete Flow

### 1. Contract Creation
```
Agency calls POST /api/contracts
  → Contract saved to DB
  → If factory configured: ContractFactory.createDeal() on-chain
  → ServiceContract + ContractToken deployed atomically
  → Addresses stored in DB
  → Invite email sent to counterparty
```

### 2. Escrow Deposit
```
Client calls POST /api/contracts/[id]/deposit
  → ERC20 approve + ServiceContract.depositEscrow() on-chain
  → Contract status: Draft → Active
```

### 3. Milestone Delivery & Approval
```
Agency: POST /api/contracts/[id]/deliver (with proof)
  → ServiceContract.submitDeliverable() on-chain
  → Milestone: pending → delivered

Client: POST /api/contracts/[id]/approve
  → ServiceContract.approveMilestone() on-chain
  → Fee split: 2.5% platform + BD% + agency remainder
  → Optional: Unlink private transfer to agency
```

### 4. Tokenization (Agency only)
```
Agency calls POST /api/contracts/[id]/tokenize
  → ContractToken.mint() — tokens minted
  → Uniswap V3 pool created (ContractToken/USDC)
  → Initial liquidity added (full-range position)
```

### 5. Investor Purchase
```
Investor calls POST /api/marketplace/[tokenId]/buy
  → USDC → ContractToken swap via Uniswap V3
  → Real AMM execution (not a custom marketplace)
```

### 6. Dispute (Partial — DB only)
```
Either party: POST /api/contracts/[id]/dispute
  → Evidence submission period
  → Both pay arbitration fee (1-month deadline)
  → Default ruling if one doesn't pay
  → Kleros court NOT YET WIRED (future: requires Arbitrum)
```

## Privacy (Unlink ZKP — Optional)

When configured (`UNLINK_API_KEY`), escrow deposits and agency payouts can use Unlink's shielded pools for on-chain privacy:
- `privateDeposit()` — client deposits USDC into shielded pool
- `privateTransfer()` — milestone payout to agency (private)
- `privateWithdraw()` — agency withdraws to their wallet

## What Investors Can NEVER See

- Client name or wallet address
- Full contract terms or deliverable proofs
- Fee split configuration (BD%, platform%)
- Escrow balance details

Investors see only what the agency chose to expose during tokenization (via `TokenizationExposure` settings).

## Future Enhancements

- **Kleros integration** — requires moving to Arbitrum (Kleros is native there)
- **On-chain agency reputation** (AgencyProfile.sol) — currently DB-only
- **On-chain document storage** — currently evidence is DB-only
- **Investor holdings tracking** — add `holdings` table to DB
- **Trust Oracle** — public reputation verification page
