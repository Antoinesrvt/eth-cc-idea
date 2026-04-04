# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

**TrustSignal** — a platform to tokenize service contracts into investable, tradeable ERC20 tokens. Agencies create contracts, clients deposit escrow, and investors buy contract tokens on Uniswap V3.

**Roles:** Client (pays), Agency (delivers), Business Dev (brokers, earns commission), Investor (buys tokens, earns yield).

## Build & Run

```bash
pnpm dev                 # Next.js dev server
pnpm build               # Production build
pnpm test                # Run tests (vitest)
pnpm contracts:build     # Compile Solidity (Foundry)
pnpm generate:abis       # Rebuild ABIs from Solidity → TypeScript
```

### Local Development (Anvil fork of Base Sepolia)
```bash
# Terminal 1: Start Anvil (forks Base Sepolia for Uniswap V3)
anvil --fork-url https://sepolia.base.org

# Terminal 2: Deploy contracts
cd idt-app && ./scripts/deploy-local.sh
# → Outputs env vars to paste into .env.local
```

## Architecture

### Stack
- **Next.js 16** (App Router) with React 19 and React Compiler
- **HeroUI v3** (`@heroui/react`) — primary UI component library
- **Tailwind CSS v4** with OKLCH custom theme tokens
- **Privy** — authentication (email, Google, Telegram, wallet) + embedded wallets
- **ethers.js v6** — blockchain interaction
- **Uniswap V3** — token marketplace (AMM pools)
- **Unlink SDK** — ZKP privacy for escrow deposits/payouts
- **Framer Motion** — animations
- **Lucide React** — icons

### Chain — Base Sepolia (local: Anvil fork)
All contract and marketplace activity happens on Base Sepolia (or a local Anvil fork of it). The fork gives us Uniswap V3 contracts for free.

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

**Tables** (Drizzle schema in `src/lib/db/schema.ts`):

| Table | Key | Purpose |
|---|---|---|
| `contracts` | UUID | Service contracts |
| `milestones` | contractId + id | Milestones per contract |
| `users` | wallet address | User profiles |
| `agencyProfiles` | wallet address | Agency reputation (DB-only for now) |
| `disputes` | UUID | Dispute phases, party responses, evidence |
| `escrows` | contractId | Escrow state + deposit records (JSON column) |

**Not yet in schema (TODO):** `documents` (evidence storage), `holdings` (investor portfolio tracking).

**Data flow:** API routes (`src/app/api/`) serve JSON → client hooks (`src/hooks/`) consume them. `useApi<T>(url)` for reads, `postApi<T>(url, body)` for mutations.

### Blockchain Sync Pattern

**DB is the source of truth for the UI. Chain is the source of truth for escrow.**

API routes follow "chain-first" pattern: execute the on-chain transaction, then update DB. If the chain call fails, the DB is not updated.

### Dispute Flow (Current Implementation)
1. **Evidence Phase:** Either party starts dispute. Both submit evidence.
2. **Fee Payment:** Both parties pay arbitration fee (1-month deadline).
   - One party doesn't pay → loses by default
   - Both pay → marked as "kleros_review" in DB
3. **Kleros Review:** NOT YET WIRED — dispute phases are DB-only. Actual Kleros court integration is a future enhancement (requires Arbitrum, not available on Base Sepolia).

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
| `uniswap/` | Uniswap V3 pool creation, swaps, quotes, liquidity |
| `privacy/` | Unlink SDK — ZKP shielded deposits/transfers/withdrawals |
| `payments/` | Privy server auth, escrow fee calculations |
| `email/` | Resend — invite & notification emails (14 types) |
| `db/` | Drizzle ORM — contracts, users, disputes, escrows |
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

Fee structure: 2.5% platform (fixed) + 0-20% BD commission + remainder to agency, per milestone.

### Future / Not Yet Implemented
- **On-chain agency reputation** (AgencyProfile.sol) — currently DB-only
- **On-chain document storage** (DocumentStore) — currently console.log only
- **Kleros court integration** — requires Arbitrum; on Base Sepolia disputes are DB-only
- **Trust Oracle page** (/oracle) — not yet built
- **Investor holdings tracking** — swaps execute on Uniswap but no DB record

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Yes | Privy app ID |
| `PRIVY_APP_SECRET` | Yes | Privy server secret |
| `DATABASE_URL` | Yes | Neon Postgres connection string |
| `RPC_URL` | Yes | RPC endpoint — `http://localhost:8545` (local) or Base Sepolia (server) |
| `NEXT_PUBLIC_RPC_URL` | Yes | RPC endpoint (client, for balance display) |
| `CHAIN_ID` | Yes | `31337` (local Anvil) or `84532` (Base Sepolia) |
| `DEPLOYER_PRIVATE_KEY` | At deploy | Wallet private key for on-chain operations |
| `CONTRACT_FACTORY_ADDRESS` | At deploy | ContractFactory singleton |
| `PAYMENT_TOKEN_ADDRESS` | At deploy | Test USDC address |
| `PLATFORM_TREASURY` | At deploy | Address to receive 2.5% platform fees |
| `RESEND_API_KEY` | Optional | Email sending (gracefully degrades if missing) |
| `UNLINK_API_KEY` | Optional | Unlink ZKP privacy (optional) |
| `EVM_PRIVATE_KEY` | Optional | For Unlink wallet client |

## Path Alias

`@/*` maps to `./src/*` — always use `@/` imports, never relative `../../` paths.
