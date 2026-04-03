# TrustSignal — Chain Architecture

## The Two-Chain Model

TrustSignal uses Rayls' privacy architecture: a **Private Node** for confidential contract execution and a **Public Chain** for investor-facing operations. The separation is fundamental — mixing them breaks privacy.

```
┌─────────────────────────────────────────────────────┐
│  PRIVACY NODE (Chain 800000)                        │
│  Who has access: only client + agency               │
│  What lives here: contract terms, escrow, proofs    │
│                                                     │
│  ContractFactory (singleton)                        │
│    └── createDeal() deploys per-deal:               │
│                                                     │
│  ServiceContract (per-deal orchestrator)             │
│    ├── Escrow: client deposits USDr                 │
│    ├── Milestones: state machine                    │
│    ├── Fee splits: platform + BD + agency           │
│    ├── AI verdict hashes                            │
│    └── Controls ContractToken minting               │
│                                                     │
│  ContractToken (per-deal ERC20)                     │
│    ├── Minted TO THE AGENCY (not investors)         │
│    └── Agency bridges via teleportToPublicChain()   │
│                                                     │
└──────────────────┬──────────────────────────────────┘
                   │ Rayls bridge (automatic)
                   │ Tokens teleported by agency
                   │ Settlements bridged by relayer
                   ▼
┌─────────────────────────────────────────────────────┐
│  PUBLIC CHAIN (Chain 7295799)                       │
│  Who has access: everyone (investors, public)       │
│  What lives here: tokens, marketplace, reputation   │
│                                                     │
│  Mirror Token (auto-deployed by Rayls relayer)      │
│    └── Same ERC20, tradeable on public chain        │
│                                                     │
│  Marketplace (singleton)                            │
│    └── Agency lists tokens, INVESTORS buy here      │
│                                                     │
│  EscrowPublic (per-deal, deployed by relayer)       │
│    ├── Receives settlement from Privacy Node        │
│    ├── Investors burn mirror tokens to redeem USDr  │
│    └── IArbitrableV2 for Kleros disputes            │
│                                                     │
│  Attestation (singleton) — AI verdict summaries     │
│  AgencyProfile (singleton) — on-chain reputation    │
│  ForeignGateway (singleton) → Kleros bridge         │
│                                                     │
└─────────────────────────────────────────────────────┘
                   │ Hyperlane
                   ▼
┌─────────────────────────────────────────────────────┐
│  ARBITRUM (Chain 42161)                             │
│  HomeGateway → KlerosCoreNeo (dispute resolution)   │
└─────────────────────────────────────────────────────┘
```

## What Goes Where (THE RULE)

| Data | Chain | Why |
|---|---|---|
| Contract terms, milestones, deadlines | Privacy Node | Confidential between client + agency |
| Client identity (name, address) | Privacy Node | **NEVER on public chain** |
| Escrow (client's USDr) | Privacy Node | Held by ServiceContract |
| Deliverable proofs | Privacy Node | Agency's work product |
| AI verdict details | Privacy Node | Full reasoning stays private |
| AI verdict hash + score | Public Chain (Attestation) | Summary for investors, no details |
| ContractToken (original) | Privacy Node | Minted here, bridged out |
| Mirror Token | Public Chain | Auto-created by Rayls relayer |
| Token marketplace | Public Chain | Investors buy/sell here |
| Settlement pool | Public Chain (EscrowPublic) | Investors redeem here |
| Agency reputation | Public Chain | Public trust signal |
| Kleros disputes | Arbitrum | Decentralized court |

## The Complete Flow

### 1. Contract Creation (Privacy Node)
```
Agency calls ContractFactory.createDeal()
  → ServiceContract deployed (holds milestones, fee config)
  → ContractToken deployed (ERC20, owned by ServiceContract)
  → Both linked together
```

### 2. Escrow Deposit (Privacy Node)
```
Client calls ServiceContract.depositEscrow()
  → Sends USDr (exact totalValue)
  → Contract status: Draft → Active
```

### 3. Tokenization (Privacy Node → Public Chain)
```
Agency calls ServiceContract.mintTokensForBridge(supply)
  → Tokens minted to agency's Privacy Node address
Agency calls ContractToken.teleportToPublicChain(publicAddress, supply, 7295799)
  → Rayls relayer auto-deploys Mirror Token on Public Chain
  → Agency receives mirror tokens on Public Chain
Agency calls Marketplace.list(mirrorTokenAddress, amount, price)
  → Tokens listed at discount (e.g., $0.90 for $1 face value)
```

### 4. Investor Purchase (Public Chain ONLY)
```
Investor calls Marketplace.buy(listingId)
  → Sends USDr to Marketplace
  → Receives mirror tokens
  → INVESTOR NEVER TOUCHES PRIVACY NODE
```

### 5. Milestone Delivery & Approval (Privacy Node)
```
Agency: ServiceContract.submitDeliverable(milestoneId, proofHash)
Client: ServiceContract.approveMilestone(milestoneId)
  → Fee split:
    → 2.5% → platformTreasury
    → BD%  → BD wallet
    → rest → agency wallet
  → Emits MilestoneSettled event
  → Relayer bridges settlement amount to EscrowPublic on Public Chain
```

### 6. Investor Redemption (Public Chain)
```
Relayer calls EscrowPublic.settle() with milestone settlement amount
Investor calls EscrowPublic.redeem(tokenAmount)
  → Burns mirror tokens
  → Receives pro-rata USDr: (tokens * totalSettled) / totalSupply
```

### 7. Dispute Resolution
```
Privacy Node: ServiceContract.disputeMilestone() or rejectMilestone()
Platform: ServiceContract.recordAiVerdict(milestoneId, hash, decision, score)
  → AI gives 3-way decision: approved / rejected / insufficient_data

If parties don't agree with AI:
  Public Chain: EscrowPublic.createDispute()
    → ForeignGateway dispatches to Arbitrum via Hyperlane
    → HomeGateway creates dispute on KlerosCoreNeo
    → Jurors review evidence + AI verdict
    → Ruling relayed back
    → EscrowPublic enforces ruling
```

## Trust Oracle

The **Trust Oracle** is a public reputation verification layer. It reads from both the database (fast, primary) and the `AgencyProfile.sol` smart contract (on-chain verification).

```
Frontend (/oracle)
    │
    ├── GET /api/oracle/profile?address=0x...
    │     ├── db.users.findByAddress()         → DB profile
    │     ├── getAgencyScore(address)           → on-chain score
    │     ├── getAgencyProfile(address)         → on-chain Profile struct
    │     └── getAgencyTier(address)            → on-chain tier string
    │     → Merged response: OracleProfile
    │
    ├── GET /api/oracle/leaderboard?sort=score
    │     └── agencyProfiles JOIN users → sorted, limited
    │
    └── GET /api/oracle/attestations?agency=0x...
          ├── db.contracts.findByUser(agency)   → agency's contracts
          └── db.attestations.findByContract()  → per-contract verdicts
          → Client addresses STRIPPED from response
```

### On-Chain Reputation (AgencyProfile.sol)

The `AgencyProfile` contract on the Public Chain stores:

- `contractsCompleted`, `contractsFailed` — completion history
- `disputesWon`, `disputesLost` — dispute track record
- `totalVolume` — cumulative USD value
- `totalAiScore` — sum of AI scores (avg = total / completed)
- `streak` — consecutive completions without disputes
- `verified` — KYC flag
- `attestationHashes[]` — legal document hashes

Score formula: `(completionRate * 40 + disputeWinRate * 30 + avgAiScore * 30) / 100`

Tiers: Elite (96+), Diamond (81+), Established (61+), Growing (31+), Seedling (0-30).

The Oracle frontend cross-references DB data with on-chain data and displays both, allowing users to verify that the platform's database matches the immutable chain state.

## Frontend Rules

| Page/Feature | Calls Privacy Node? | Calls Public Chain? |
|---|---|---|
| Create contract | YES (factory) | NO |
| Deposit escrow | YES (ServiceContract) | NO |
| Submit deliverable | YES (ServiceContract) | NO |
| Approve/reject milestone | YES (ServiceContract) | NO |
| Tokenize (mint + bridge) | YES (mint) + YES (teleport) | Auto (relayer) |
| List on marketplace | NO | YES (Marketplace) |
| Buy tokens | NO | YES (Marketplace) |
| Redeem tokens | NO | YES (EscrowPublic) |
| View contract details | YES (if party) | NO |
| View marketplace listing | NO | YES |
| View agency profile | NO | YES (AgencyProfile) |
| **Trust Oracle** | **NO** | **YES (AgencyProfile, read-only)** |
| Start dispute | YES (ServiceContract) | YES (EscrowPublic for Kleros) |

## What Investors Can NEVER See

- Client name or wallet address
- Full contract terms or deliverable proofs
- AI verdict full reasoning (only hash + score via Attestation)
- Escrow balance details
- Fee split configuration (BD%, platform%)

Investors see only what the agency chose to expose during tokenization (via `TokenizationExposure` settings).
