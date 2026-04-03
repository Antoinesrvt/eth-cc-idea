# TrustSignal

**Tokenize service contracts into investable assets with private escrow and decentralized dispute resolution.**

Built for [ETHGlobal Cannes 2026](https://ethglobal.com/events/cannes2026).

## What It Does

Agencies create service contracts with milestone-based escrow. Clients deposit USDC privately via ZKP. Investors trade contract tokens on Uniswap. Disputes go to Kleros court.

**For Agencies:** Create a contract, get paid per milestone, tokenize your receivables on Uniswap.

**For Clients:** Deposit escrow privately (ZKP). Funds release only when you approve milestones.

**For Investors:** Buy contract tokens on Uniswap at a discount. Earn yield when milestones complete.

## Architecture

```
Arbitrum (single chain)
├── ServiceContract (per-deal escrow + milestones)
├── Unlink (ZKP private deposits/payouts)
├── Uniswap V3 (secondary market for contract tokens)
└── KlerosCoreNeo (dispute resolution)
```

## Prize Tracks

| Track | Partner | What we use |
|---|---|---|
| **Stablecoin Logic** | Arc (Circle) | USDC escrow with conditional milestone releases |
| **Private Payments** | Unlink | ZKP-shielded deposits and payouts |
| **DEX Integration** | Uniswap | AMM pools for contract token trading |

## Quick Start

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, HeroUI v3, Tailwind CSS v4 |
| Auth | Privy (Google, Telegram, wallet) |
| Database | Neon Postgres + Drizzle ORM |
| Chain | Arbitrum |
| Payments | USDC (Circle) via Unlink (ZKP) |
| Marketplace | Uniswap V3 |
| Disputes | Kleros v2 |
| Email | Resend |

## Structure

```
src/
├── app/              Pages + API routes
├── components/       UI components (HeroUI)
├── hooks/            useAuth, useApi, useContracts, useMarketplace, useProfile
└── lib/
    ├── auth/         Privy middleware
    ├── blockchain/   ethers.js + ServiceContract
    ├── db/           Drizzle (contracts, milestones, disputes, escrows, users)
    ├── email/        Resend invitations
    ├── payments/     Escrow math + Privy server auth
    ├── types/        TypeScript interfaces
    └── utils/        Rate limiting, validation

contracts/
└── src/
    └── ServiceContract.sol   Escrow + milestones + fee splits
```

## License

MIT
