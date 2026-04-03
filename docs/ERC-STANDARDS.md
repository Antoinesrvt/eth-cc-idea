# TrustSignal — ERC Standards Reference

How we use (and don't use) Ethereum standards across the platform.

---

## Standards We Use

### ERC-20 — Fungible Token (ContractToken.sol)

**What:** The standard interface for fungible tokens — `transfer`, `approve`, `balanceOf`, `totalSupply`.

**How we use it:** `ContractToken.sol` is a standard ERC-20 representing fractional ownership of a service contract's receivable. Investors buy tokens, hold them while the contract executes, and burn them to redeem settlement funds.

**Why ERC-20:** Universal compatibility — works with every wallet, DEX, and analytics tool. Investors can freely trade tokens on the Marketplace or any Uniswap-like protocol.

**Extensions:** We inherit from Rayls' `RaylsErc20Handler` which adds `teleportToPublicChain()` for cross-chain bridging between Privacy Node and Public Chain.

---

### ERC-20 Burn-to-Redeem Pattern (EscrowPublic.sol)

**What:** A well-established pattern (not a formal ERC) where token holders burn tokens to claim underlying assets from a pool. Used by Frax, RAI, and yield-bearing tokens.

**How we use it:** `EscrowPublic.redeem(amount)` burns the caller's ContractTokens and transfers their pro-rata share of settled USDr:

```
redeemAmount = tokenAmount * totalSettled / totalSupply
```

**Why this pattern:** Trustless, permissionless, and mathematically fair. No admin can rug — the formula is deterministic and auditable on-chain.

---

### IArbitrableV2 — Kleros v2 Arbitration (EscrowPublic.sol)

**What:** The interface that contracts must implement to use Kleros v2 as a dispute resolution mechanism. Replaces the older ERC-792 `IArbitrable`.

**How we use it:** `EscrowPublic.sol` implements:
- `rule(uint256 disputeID, uint256 ruling)` — callback from the arbitrator with the final verdict
- `DisputeRequest` event — emitted when creating a dispute, with `templateId` and `templateUri` for structured dispute metadata

**Why IArbitrableV2 over ERC-792:** Kleros v2 (KlerosCoreNeo on Arbitrum) requires the v2 interface. The key additions are dispute templates (replacing the v1 `MetaEvidence` pattern) and support for ERC-20 fee payment.

---

### IArbitratorV2 — Kleros v2 Arbitrator Facade (ForeignGateway.sol)

**What:** The interface for contracts that ACT as arbitrators — exposing `createDispute()` and `arbitrationCost()`.

**How we use it:** `ForeignGateway.sol` on the Rayls Public Chain implements `IArbitratorV2` as a facade. It accepts dispute creation from `EscrowPublic`, dispatches the request to Arbitrum via Hyperlane, and relays rulings back. From EscrowPublic's perspective, ForeignGateway looks like a local arbitrator.

---

### ERC-1497 — Evidence Standard (EscrowPublic.sol)

**What:** Defines how evidence and dispute context are submitted in arbitration. Two key events:
- `MetaEvidence(metaEvidenceID, evidence)` — emitted at creation, points to the dispute resolution policy
- `Evidence(arbitrator, evidenceGroupID, party, evidence)` — emitted when parties submit evidence during a dispute

**How we use it:**
- Constructor emits `MetaEvidence` with an IPFS URI to the dispute policy document
- `submitEvidence(evidenceURI)` allows both parties to submit evidence (deliverable proofs, AI attestation results, arguments) during an active dispute
- Evidence URIs point to IPFS-hosted JSON: `{ "name": "...", "description": "...", "fileURI": "/ipfs/Qm..." }`

**Why it matters:** Without ERC-1497, Kleros jurors cannot see any context for the dispute. These events are what feed the Kleros Court UI with evidence for jurors to review.

---

## Standards We Considered but Don't Use

### ERC-3643 (T-REX) — Regulated Security Tokens

**What:** A permissioned token standard with on-chain identity registry (ONCHAINID), compliance rules, and transfer restrictions. Designed for regulated securities with full KYC/AML enforcement at the token transfer level.

**Why we don't use it:** Overkill for our use case. TrustSignal tokens represent claims on service contract receivables, not publicly traded securities. ERC-3643 requires deploying 5+ additional contracts (Identity Registry, Compliance, Trusted Issuers Registry, etc.) and every token holder would need an on-chain identity claim. Rayls' Privacy Node already provides confidentiality for sensitive data.

**When we would use it:** If TrustSignal scales to institutional investors and regulatory classification as a security instrument becomes necessary.

---

### ERC-1400 — Security Token Standard

**What:** A modular standard with partitioned balances (tranches), operator controls, and document management. Allows tokens to be split into classes.

**Why we don't use it:** Never achieved final EIP status, has limited tooling, and its tranche model adds complexity our escrow system already handles. ServiceContract.sol manages milestone partitioning at the escrow level — we don't need it replicated at the token level.

**When we would use it:** If we needed per-milestone token classes (e.g., "Milestone 1 tokens" vs "Milestone 2 tokens" with different risk profiles).

---

### ERC-4626 — Tokenized Vault

**What:** The DeFi standard for yield-bearing vaults. Defines `deposit(assets) → shares`, `withdraw(shares) → assets`, `previewRedeem`, `convertToAssets`, etc.

**Why we don't use it:** Semantically, our EscrowPublic IS a vault — settlement funds accumulate, token holders withdraw proportionally. The mismatch: ERC-4626 expects the underlying asset to be an ERC-20 token, but we use native USDr (like ETH). Implementing ERC-4626 would require wrapping USDr into an ERC-20 first, adding unnecessary complexity.

**What we do instead:** Our `redeem()` and `previewRedeem()` functions follow the same mathematical pattern as ERC-4626, just with native token instead of ERC-20.

**When we would use it:** If Rayls introduces a wrapped USDr ERC-20, we would migrate EscrowPublic to inherit `ERC4626` from OpenZeppelin for full DeFi composability (integration with aggregators, yield dashboards, etc.).

---

### ERC-5192 — Soulbound Tokens (Non-Transferable NFTs)

**What:** Extends ERC-721 with a `locked()` function for non-transferable tokens. Used for on-chain identity, credentials, and reputation.

**Why we don't use it:** Our `AgencyProfile.sol` uses a simpler mapping-based approach. A soulbound NFT would add wallet visibility (agencies could show their reputation NFT in MetaMask), but requires minting infrastructure, metadata hosting (tokenURI), and more complex querying.

**When we would use it:** When reputation becomes a portable, cross-platform identity. An agency's TrustSignal reputation badge as a soulbound NFT could be recognized by other platforms, job boards, or DeFi protocols.

---

### ERC-735 — Claims / Attestations

**What:** A standard for attaching key-value claims to identity contracts. Claims can be self-issued or issued by trusted parties.

**Why we don't use it:** Too complex for our needs, limited tooling, and largely superseded by newer approaches. Our `Attestation.sol` handles AI verdicts with a simpler event + mapping pattern.

---

### ERC-2771 — Meta-Transactions (Gasless)

**What:** A protocol for relayed transactions where a trusted forwarder submits transactions on behalf of users, and contracts read the real sender from appended calldata.

**Why we don't use it:** Rayls Privacy Node is already gasless by design — no meta-transaction layer needed. On the Public Chain, the main actors are our backend (which pays its own gas) and investors (who need USDr anyway to buy tokens).

**When we would use it:** If we wanted fully gasless interactions on the Public Chain for investors (e.g., gasless marketplace purchases). Would require deploying an `ERC2771Forwarder` and modifying all Public Chain contracts to use `_msgSender()` instead of `msg.sender`.

---

### EIP-5164 — Cross-Chain Execution

**What:** A bridge-agnostic standard for cross-chain message dispatching and execution.

**Why we don't use it:** Rayls has its own internal cross-chain protocol (using EIP-5164 internally). Our Kleros bridge uses Hyperlane's `dispatch/handle` pattern, which is a concrete implementation rather than an abstraction. Adding EIP-5164 as an intermediary would be an unnecessary layer.

---

## Standards Roadmap

| Phase | Standard | Feature |
|---|---|---|
| **Now** | ERC-20 | ContractToken — fractional ownership |
| **Now** | IArbitrableV2 / IArbitratorV2 | Kleros dispute resolution |
| **Now** | ERC-1497 | Evidence submission for disputes |
| **Next** | ERC-4626 | Vault-compatible EscrowPublic (requires wrapped USDr) |
| **Next** | ERC-5192 | Soulbound reputation NFTs for agencies |
| **Future** | ERC-3643 | Regulated security token compliance |
| **Future** | ERC-2771 | Gasless Public Chain interactions |

---

## Quick Reference: Our Contracts × ERCs

| Contract | ERCs Used | Chain |
|---|---|---|
| **ContractToken.sol** | ERC-20 + Rayls bridge | Privacy → Public |
| **EscrowPublic.sol** | ERC-20 burn-to-redeem, IArbitrableV2, ERC-1497 | Public Chain |
| **ForeignGateway.sol** | IArbitratorV2 | Public Chain |
| **HomeGateway.sol** | IArbitratorV2 (consumer) | Arbitrum |
| **ServiceContract.sol** | — (custom escrow, no ERC) | Privacy Node |
| **Marketplace.sol** | ERC-20 (handles), ERC-721 (handles) | Public Chain |
| **Attestation.sol** | — (custom events, no ERC) | Public Chain |
| **AgencyProfile.sol** | — (custom mapping, no ERC) | Public Chain |
