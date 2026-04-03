# TrustSignal Smart Contracts

## Overview

TrustSignal uses 7 smart contracts across 3 chains to enable tokenized service contract investment with AI verification and decentralized dispute resolution.

## Contracts

### Privacy Node (Rayls, Chain 800000)

#### ServiceContract.sol
The core escrow contract. Stores milestones, holds client funds, and splits fees on approval.

| Function | Who calls | What it does |
|---|---|---|
| `depositEscrow()` | Client | Locks full contract value in native USDr |
| `submitDeliverable(milestoneId, proofHash)` | Agency | Records IPFS hash of deliverable proof |
| `approveMilestone(milestoneId)` | Client | Releases escrow with fee split: 2.5% platform + BD% + agency |
| `disputeMilestone(milestoneId)` | Client | Flags milestone for dispute resolution |
| `markFailed()` | Client | Marks unfinished milestones as failed |
| `refundEscrow()` | Client | Returns remaining balance after failure |

**Fee split (on each milestone approval):**
```
milestoneAmount = $10,000
platformFee    = $10,000 * 2.5%  = $250   → platform treasury
bdFee          = $10,000 * 5%    = $500   → BD wallet (if assigned)
agencyPayout   = $10,000 - $750  = $9,250 → agency wallet
```

**Deploy:**
```bash
source .env
forge script script/DeployServiceContract.s.sol --rpc-url $PRIVACY_NODE_RPC_URL --broadcast --legacy
```

---

### Public Chain (Rayls, Chain 7295799)

#### Marketplace.sol (from starter kit)
Escrow marketplace for buying/selling ERC20 and ERC721 tokens.

#### Attestation.sol (from starter kit, modified)
Stores AI verification verdicts on-chain: `(token, approved, reason, score, timestamp)`.

#### EscrowPublic.sol
Settlement pool for investors. Receives funds when milestones are approved on Privacy Node.

| Function | Who calls | What it does |
|---|---|---|
| `settle()` | Bridge/relayer | Deposits settlement funds (native USDr) |
| `completeSettlement()` | Owner | Marks all milestones as settled |
| `redeem(tokenAmount)` | Investor | Burns ContractTokens, receives pro-rata USDr |
| `previewRedeem(tokenAmount)` | Anyone (view) | Shows how much USDr burning X tokens would yield |
| `createDispute()` | Token holder | Creates Kleros dispute via ForeignGateway |
| `rule(disputeID, ruling)` | ForeignGateway | Receives Kleros ruling |

**Redemption formula:**
```
redeemAmount = tokenAmount * totalSettled / totalTokenSupply
```

#### AgencyProfile.sol
On-chain reputation registry. Tracks completion rate, disputes, AI scores, and computes a weighted score.

**Score formula:**
```
completionRate = completed / (completed + failed) * 100      [weight: 40%]
disputeRate    = disputesWon / (disputesWon + disputesLost)   [weight: 30%]
avgAiScore     = totalAiScore / completed                     [weight: 30%]
score          = (completionRate * 40 + disputeRate * 30 + avgAiScore * 30) / 100
```

**Tier system:**
| Score | Tier |
|---|---|
| 96-100 | Elite |
| 81-95 | Diamond |
| 61-80 | Established |
| 31-60 | Growing |
| 0-30 | Seedling |

#### ForeignGateway.sol
IArbitratorV2 facade on Rayls. Dispatches disputes to Arbitrum via Hyperlane Mailbox.

---

### Arbitrum (Chain 42161)

#### HomeGateway.sol
Receives disputes from Rayls via Hyperlane. Creates disputes on KlerosCoreNeo (`0x991d2df165670b9cac3B022f4B68D65b664222ea`). Relays rulings back via Hyperlane.

**Dispute flow:**
```
EscrowPublic.createDispute()
  → ForeignGateway.createDispute() [Rayls Public Chain]
    → Hyperlane dispatch
      → HomeGateway.handle() [Arbitrum]
        → KlerosCoreNeo.createDispute()
          → Jurors vote
            → HomeGateway.rule()
              → Hyperlane dispatch
                → ForeignGateway.handle() [Rayls]
                  → EscrowPublic.rule()
```

## Deployment Order

1. **Privacy Node:** `ServiceContract.sol`
2. **Public Chain:** `Marketplace.sol`, `Attestation.sol`, `AgencyProfile.sol`
3. **Public Chain:** `EscrowPublic.sol` (needs ContractToken address)
4. **Public Chain:** `ForeignGateway.sol` (needs Hyperlane Mailbox address)
5. **Arbitrum:** `HomeGateway.sol` (needs KlerosCoreNeo + Hyperlane Mailbox)
6. Configure: `ForeignGateway.setHomeGateway(homeGatewayAddress)`

## Security

- ReentrancyGuard on all fund transfers (ServiceContract, EscrowPublic)
- Checks-effects-interactions pattern throughout
- Custom errors for gas optimization
- Owner-only admin functions
- Fee caps: BD max 20% (2000 bps), platform fixed at 2.5% (250 bps)
- Arbitrator-only `rule()` callback on EscrowPublic
