# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

**TrustSignal** — a platform to tokenize service contracts into investable, tradeable ERC20 tokens. Agencies create contracts on Arbitrum, Kleros resolves disputes, and investors buy contract tokens on a marketplace.

**Roles:** Client (pays), Agency (delivers), Business Dev (brokers, earns commission), Investor (buys tokens, earns yield).

## Build & Run

```bash
npm run dev              # Next.js dev server
npm run build            # Production build
npm run test             # Run tests (vitest, uses in-memory SQLite)
npm run contracts:build  # Compile Solidity (Foundry)
npm run generate:abis    # Rebuild ABIs from Solidity → TypeScript
```

## Architecture

### Stack
- **Next.js 16** (App Router) with React 19 and React Compiler
- **HeroUI v3** (`@heroui/react`) — primary UI component library
- **Tailwind CSS v4** with OKLCH custom theme tokens
- **Privy** — authentication (email, Google, Telegram, wallet) + embedded wallets
- **ethers.js v6** — blockchain interaction
- **Framer Motion** — animations
- **Lucide React** — icons

### Single Chain — Arbitrum
All contract and marketplace activity happens on Arbitrum (Sepolia testnet or mainnet). Kleros v2 is native on Arbitrum — no bridge needed.

**RPC:** `process.env.RPC_URL` (server) / `process.env.NEXT_PUBLIC_RPC_URL` (client)

### Monorepo Structure
```
contracts/                    ← Foundry project (Solidity source of truth)
├── src/                      ← .sol files
├── script/                   ← Deploy scripts
└── foundry.toml

scripts/
└── generate-abis.ts          ← Reads contracts/out/ → generates src/lib/blockchain/abis/

src/lib/blockchain/abis/      ← AUTO-GENERATED from Solidity — never edit by hand
```

**ABIs are generated, not hand-written.** Change Solidity → run `npm run generate:abis` → TypeScript ABIs update automatically.

### Data Layer

**Neon Postgres + Drizzle ORM** (`src/lib/db/`). Connection via `DATABASE_URL` env var. Client in `client.ts` exports `getDb()` — lazy-initialized, type-safe, no connection at import time (safe for `next build`). Schema in `schema.ts` (`pgTable`). All `db.*` functions are **async** — always `await` them. Each API route calls `await ensureInit()` first to ensure tables exist.

**Collections** — all accessed via `db.*` from `@/lib/db`:

| Collection | Key | Purpose |
|---|---|---|
| `db.contracts` | UUID | Service contracts + milestones (separate table) |
| `db.users` | wallet address | User profiles + agency profiles (separate table) |
| `db.escrows` | contractId | Escrow state + deposit records (JSON column) |
| `db.disputes` | UUID | Dispute phases, party responses, evidence |
| `db.attestations` | UUID | On-chain attestation records |
| `db.documents` | UUID | **Stored text content** for dispute evidence (contract terms, deliverable proofs, evidence) |
| `db.blockchainEvents` | UUID | **Audit log** of every blockchain call (status, txHash, errors) |
| `db.listings` | auto-increment | Marketplace listing mirror |
| `db.holdings` | auto-increment | Investor token holdings |

**Data flow:** API routes (`src/app/api/`) serve JSON → client hooks (`src/hooks/`) consume them. `useApi<T>(url)` for reads, `postApi<T>(url, body)` for mutations.

### Document Storage Pattern

**Never discard user-submitted content.** When text is extracted from a PDF or a deliverable description is submitted, it must be stored in `db.documents` so it can be referenced in disputes.

Three document types:
- `contract_terms` — extracted PDF text, stored at contract creation
- `deliverable` — description + links, stored at milestone delivery
- `evidence` — dispute evidence submissions

### Blockchain Sync Pattern

**DB is the source of truth for the UI. Chain is the source of truth for escrow.**

All blockchain calls are "DB first, chain second":
1. Write to DB (immediate, always succeeds)
2. Return response to UI (fast)
3. Attempt blockchain call via `db.blockchainEvents.tracked()` (async, may fail)

The `tracked()` helper automatically creates a pending event, runs the chain call, then marks it confirmed or failed.

```typescript
// Good:
await db.blockchainEvents.tracked(
  { contractId: id, operation: "approve", chain: "arbitrum" },
  async () => { const txHash = await approveMilestone(...); return { txHash }; },
);
```

### 2-Phase Dispute Flow
1. **Evidence Phase:** Either party starts dispute. Both parties submit evidence/arguments.
2. **Kleros Payment:** Both parties pay the Kleros arbitration fee (1-month deadline).
   - One party doesn't pay → loses by default
   - Both pay → proceed to Kleros review
3. **Kleros Review:** Jurors review all evidence and rule. Winner gets fee refunded from loser.

### Critical Product Rules
- **Client identity is NEVER public.** Investors and marketplace viewers never see client name/address.
- **No AI analysis** — disputes go directly to evidence submission + Kleros court.
- **Anyone can be agency, client, AND investor** across different contracts. Roles are per-contract.
- **Tokenization requires**: active contract (escrow deposited) + agency only.
- **Agency controls investor visibility** — chooses what data is exposed when tokenizing.

### Key Modules (`src/lib/`)
| Module | Purpose |
|--------|---------|
| `blockchain/` | ethers.js providers/signers, auto-generated ABIs, contract interaction wrappers |
| `court/` | Kleros v2 dispute creation and ruling retrieval (native on Arbitrum) |
| `payments/` | Privy server auth, escrow fee calculations |
| `db/` | Drizzle ORM — contracts, users, disputes, escrows, documents, blockchain events |
| `types/` | All shared TypeScript interfaces |

## Mandatory: Theme & Design Tokens

**Never hardcode colors, shadows, or radii.** Always use semantic CSS variables from `src/app/idt-theme.css`.

OKLCH color space. Both light and dark variants defined.

### Color tokens (Tailwind classes):
```
bg-background / text-foreground     — page base
bg-surface / bg-surface-secondary   — cards, panels
text-muted                          — secondary text
bg-accent / text-accent             — CTAs (Sea Green #2E8B57)
bg-brand / text-brand               — identity (Deep Forest Green)
bg-success / bg-warning / bg-danger — status colors
```

### How it works:
1. `src/app/idt-theme.css` defines CSS custom properties (`:root` for light, `.dark` for dark)
2. `src/app/globals.css` exposes them to Tailwind via `@theme inline`
3. Use Tailwind classes: `bg-accent`, `text-muted`, `border-border`

### What NOT to do:
- `bg-green-500` — never use Tailwind's default palette
- `#2E8B57` in components — never hardcode hex/rgb (exception: Privy config which requires hex)
- `shadow-md` — use token-based shadows

## Mandatory: HeroUI Components

Use HeroUI (`@heroui/react`) as the primary UI library. Do not install shadcn/ui or Radix.

**Custom components** in `src/components/ui/`: `StatCard`, `SectionCard`, `ScoreBadge`, `StatusBadge`, `LabeledProgress`, `PageHeader`, `FormField`, `EvidenceTag`. Check if one exists before creating new ones.

## Smart Contracts

Contracts live in `contracts/` — a self-contained Foundry project. Solidity `0.8.24`, optimizer 50 runs, EVM `paris`, `via_ir = true`.

### Factory Pattern

Contracts are deployed via `ContractFactory.createDeal()` which atomically deploys both **ServiceContract + ContractToken**, links them, and transfers token ownership to the ServiceContract.

```
POST /api/contracts → db.contracts.createContract() → factory.createDeal()
  → ServiceContract deployed (escrow + milestones)
  → ContractToken deployed (ERC20)
  → Both addresses stored in DB
```

### Contract Inventory

**Per-deal (deployed by factory):**
- **ServiceContract.sol** — escrow, milestones, fee splits.
- **ContractToken.sol** — ERC20, owned by ServiceContract.

**Singletons:**
- **ContractFactory.sol** — deploys SC+Token pairs
- **Attestation.sol** — milestone completion registry
- **AgencyProfile.sol** — on-chain reputation, weighted score, tiers

Fee structure: 2.5% platform (fixed) + 0-20% BD commission + remainder to agency, per milestone.

**Wired in TypeScript:** AgencyProfile — `recordCompletion`, `recordFailure`, `recordDisputeResult`, `getAgencyScore`, `getAgencyProfile`, `getAgencyTier` in `src/lib/blockchain/agency-profile.ts`.

### Trust Oracle (`/oracle`)

Public, read-only reputation verification page. No auth required.

- **API routes:** `GET /api/oracle/profile`, `/leaderboard`, `/attestations` — all public
- **Hook:** `src/hooks/use-oracle.ts`
- **Page:** `src/app/oracle/page.tsx`
- **Privacy rule:** Client addresses are never exposed in Oracle API responses

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Yes | Privy app ID |
| `PRIVY_APP_SECRET` | Yes | Privy server secret |
| `DATABASE_URL` | Yes | Neon Postgres connection string |
| `RPC_URL` | Yes | Arbitrum RPC endpoint (server) |
| `NEXT_PUBLIC_RPC_URL` | Yes | Arbitrum RPC endpoint (client, for balance display) |
| `CHAIN_ID` | Yes | Chain ID (421614 for Arbitrum Sepolia) |
| `DEPLOYER_PRIVATE_KEY` | At deploy | Wallet private key for on-chain operations |
| `CONTRACT_FACTORY_ADDRESS` | At deploy | ContractFactory singleton |
| `PLATFORM_TREASURY` | At deploy | Address to receive platform fees |
| `ATTESTATION_ADDRESS` | At deploy | Attestation singleton |
| `RESEND_API_KEY` | Yes | Email sending |
| `KLEROS_CORE_ADDRESS` | At deploy | Kleros v2 core on Arbitrum |

Optional: `AGENCY_PROFILE_ADDRESS`, `MARKETPLACE_ADDRESS`, `DOCUMENT_STORE_ADDRESS`.

## Path Alias

`@/*` maps to `./src/*` — always use `@/` imports, never relative `../../` paths.
