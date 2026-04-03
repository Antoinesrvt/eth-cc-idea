"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useMarketplace } from "@/hooks/use-marketplace";
import { formatCurrency as formatCurrencyUtil } from "@/lib/utils/format";
import {
  FileText,
  Coins,
  CheckCircle,
  ArrowRight,
  Scale,
  TrendingUp,
  Building2,
  UserCheck,
  BarChart3,
  Users,
  ShieldCheck,
} from "lucide-react";
import { SignalLogo } from "@/components/SignalLogo";

const FADE_UP_ANIMATION_VARIANTS = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 100, damping: 20 } },
};

const STAGGER_CHILD_VARIANTS = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 150, damping: 25 } },
};

const STAGGER_CONTAINER_VARIANTS = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const HERO_CONTAINER_VARIANTS = {
  hidden: {},
  show: { transition: { staggerChildren: 0.15 } },
};


const steps = [
  {
    icon: FileText,
    title: "Create & Escrow",
    description:
      "Agency creates a service contract with milestones. Client locks payment in escrow on Arbitrum.",
  },
  {
    icon: Coins,
    title: "Tokenize & Invest",
    description:
      "Agency tokenizes the contract and lists tokens on the marketplace. Investors buy, giving the agency liquidity.",
  },
  {
    icon: CheckCircle,
    title: "Deliver & Earn",
    description:
      "Agency delivers work. Client approves milestones. Escrow releases, investors earn yield. Reputation updates on-chain.",
  },
];

const features = [
  {
    icon: ShieldCheck,
    title: "On-Chain Escrow",
    description:
      "Funds locked in smart contracts on Arbitrum. Payments release automatically when milestones are approved.",
  },
  {
    icon: Coins,
    title: "Contract Tokenization",
    description:
      "Agencies mint ERC20 tokens backed by contract value. Investors can buy in and earn yield on delivery.",
  },
  {
    icon: Scale,
    title: "Kleros Court",
    description:
      "Unresolved disputes escalate to decentralized jurors on Kleros v2 native on Arbitrum. Evidence-based, binding rulings.",
  },
  {
    icon: TrendingUp,
    title: "Instant Liquidity",
    description:
      "Agencies don't wait 30-90 days. Tokenize your contract, sell to investors, get cash today.",
  },
];

const roles = [
  {
    icon: Building2,
    title: "Client",
    color: "accent",
    description:
      "You're paying for work. Create contracts, lock payment in escrow, approve milestones, and trigger resolutions.",
    cta: "Create a Contract",
    href: "/contracts/new",
  },
  {
    icon: UserCheck,
    title: "Agency",
    color: "brand",
    description:
      "You're delivering work. Create contracts, tokenize them to sell to investors, submit proofs, and build reputation.",
    cta: "View Dashboard",
    href: "/dashboard",
  },
  {
    icon: BarChart3,
    title: "Investor",
    color: "success",
    description:
      "You fund service work and earn yield. Browse available contract tokens, assess scores, and buy tokens.",
    cta: "Browse Marketplace",
    href: "/marketplace",
  },
  {
    icon: Users,
    title: "Business Dev",
    color: "warning",
    description:
      "You brokered the deal. Get assigned as BD when a contract is created and earn a configurable commission.",
    cta: "View Portfolio",
    href: "/portfolio",
  },
];

const colorMap: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  accent: {
    bg: "bg-accent/15",
    text: "text-accent",
    border: "border-accent/30 group-hover:border-accent/60",
    glow: "group-hover:shadow-[0_8px_30px_-4px_rgba(46,139,87,0.25)]",
  },
  brand: {
    bg: "bg-brand/15",
    text: "text-brand",
    border: "border-brand/30 group-hover:border-brand/60",
    glow: "group-hover:shadow-[0_8px_30px_-4px_rgba(10,50,30,0.25)]",
  },
  success: {
    bg: "bg-success/15",
    text: "text-success",
    border: "border-success/30 group-hover:border-success/60",
    glow: "group-hover:shadow-[0_8px_30px_-4px_rgba(16,185,129,0.25)]",
  },
  warning: {
    bg: "bg-warning/15",
    text: "text-warning",
    border: "border-warning/30 group-hover:border-warning/60",
    glow: "group-hover:shadow-[0_8px_30px_-4px_rgba(245,158,11,0.25)]",
  },
};

export default function HomePage() {
  const { listings } = useMarketplace();

  const featuredContracts = useMemo(() => {
    return listings.slice(0, 3).map((c) => ({
      id: c.tokenId,
      title: c.title,
      agency: c.agency.name ?? c.agency.address.slice(0, 10) + "...",
      score: c.avgScore ?? 0,
      value: formatCurrencyUtil(c.totalValue),
      progress: Math.round((c.completedMilestones / Math.max(c.totalMilestones, 1)) * 100),
      tokenPrice: formatCurrencyUtil(c.totalValue / 10_000, "$"),
      tokensAvailable: Math.max(0, 10_000 - Math.round(c.progress * 100)).toLocaleString(),
    }));
  }, [listings]);

  return (
    <div className="overflow-x-hidden">
      {/* Hero */}
      <section className="relative overflow-hidden min-h-[85vh] flex flex-col justify-center">
        {/* Animated Background Mesh */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-brand/10 blur-[100px]"
          />
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-accent/10 blur-[120px]"
          />
        </div>

        <motion.div
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 relative z-10"
          initial="hidden"
          animate="show"
          viewport={{ once: true }}
          variants={HERO_CONTAINER_VARIANTS}
        >
          <div className="text-center max-w-3xl mx-auto">
            <motion.div variants={STAGGER_CHILD_VARIANTS} className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-brand/10 border border-brand/20 text-sm font-medium mb-8 shadow-[0_0_15px_rgba(0,0,0,0.05)]">
              <SignalLogo size={20} className="rounded object-cover" />
              <span className="text-foreground/80">Built on Arbitrum</span>
            </motion.div>
            <motion.h1 variants={STAGGER_CHILD_VARIANTS} className="text-5xl sm:text-7xl font-bold tracking-tighter leading-[1.1]">
              Turn Your Contracts Into{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-brand">
                Investable Assets
              </span>
            </motion.h1>
            <motion.p variants={STAGGER_CHILD_VARIANTS} className="mt-6 text-lg sm:text-xl text-muted max-w-2xl mx-auto tracking-tight">
              Tokenize service agreements. Get paid upfront.
              Decentralized dispute resolution via Kleros.
            </motion.p>
            <motion.div variants={STAGGER_CHILD_VARIANTS} className="mt-10 flex items-center justify-center gap-4">
              <Link
                href="/contracts/new"
                className="flex items-center gap-2 px-8 py-4 rounded-xl bg-accent text-accent-foreground font-medium shadow-[0_4px_14px_0_rgba(46,139,87,0.39)] hover:shadow-[0_6px_20px_rgba(46,139,87,0.23)] hover:bg-accent/90 transition-all active:scale-[0.98]"
              >
                Create Contract <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/marketplace"
                className="flex items-center gap-2 px-8 py-4 rounded-xl border border-border bg-surface/50 backdrop-blur-sm text-foreground font-medium hover:bg-surface-secondary transition-all active:scale-[0.98]"
              >
                Browse Marketplace
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </section>


      {/* How It Works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 relative z-10">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          variants={STAGGER_CONTAINER_VARIANTS}
        >
          <motion.h2 variants={FADE_UP_ANIMATION_VARIANTS} className="text-4xl font-bold tracking-tight text-center mb-4">How It Works</motion.h2>
          <motion.p variants={FADE_UP_ANIMATION_VARIANTS} className="text-muted text-center mb-16 max-w-xl mx-auto tracking-tight text-lg">
            Three simple steps from contract to investable asset
          </motion.p>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <motion.div variants={STAGGER_CHILD_VARIANTS} key={step.title} className="group rounded-2xl border border-border/50 bg-surface p-8 transition-all hover:-translate-y-1 hover:shadow-xl hover:border-border">
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-accent/10 border border-accent/20 transition-colors group-hover:bg-accent/20">
                    <step.icon className="h-6 w-6 text-accent" />
                  </div>
                  <span className="text-sm font-mono text-muted/70 tracking-widest font-semibold uppercase">Step {i + 1}</span>
                </div>
                <h3 className="text-xl font-semibold mb-3 tracking-tight">{step.title}</h3>
                <p className="text-muted tracking-tight leading-relaxed">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Why TrustSignal */}
      <section className="border-t border-border/50 bg-gradient-to-b from-surface/30 to-background">
        <motion.div
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          variants={STAGGER_CONTAINER_VARIANTS}
        >
          <motion.h2 variants={FADE_UP_ANIMATION_VARIANTS} className="text-4xl font-bold tracking-tight text-center mb-16">Why TrustSignal?</motion.h2>
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((f) => (
              <motion.div variants={STAGGER_CHILD_VARIANTS} key={f.title} className="flex gap-5 rounded-2xl border border-border/50 bg-surface/50 backdrop-blur-sm p-8 transition-all hover:bg-surface hover:shadow-md">
                <div className="flex-shrink-0 flex items-center justify-center h-14 w-14 rounded-xl bg-brand/10 border border-brand/20">
                  <f.icon className="h-7 w-7 text-brand" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2 tracking-tight">{f.title}</h3>
                  <p className="text-muted tracking-tight leading-relaxed">{f.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Your Role — Guide */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          variants={STAGGER_CONTAINER_VARIANTS}
        >
          <motion.h2 variants={FADE_UP_ANIMATION_VARIANTS} className="text-4xl font-bold tracking-tight text-center mb-4">Find Your Role</motion.h2>
          <motion.p variants={FADE_UP_ANIMATION_VARIANTS} className="text-muted text-center mb-16 max-w-xl mx-auto tracking-tight text-lg">
            TrustSignal is built for four types of participants. Figure out where you fit and get started.
          </motion.p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {roles.map((role) => {
              const c = colorMap[role.color];
              return (
                <motion.div
                  variants={STAGGER_CHILD_VARIANTS}
                  key={role.title}
                  className={`group flex flex-col rounded-2xl border bg-surface p-8 transition-all hover:-translate-y-1 ${c.border} ${c.glow}`}
                >
                  <div className={`flex items-center justify-center h-12 w-12 rounded-xl transition-colors ${c.bg} mb-6`}>
                    <role.icon className={`h-6 w-6 ${c.text}`} />
                  </div>
                  <h3 className="font-semibold text-xl mb-3 tracking-tight">{role.title}</h3>
                  <p className="text-muted tracking-tight flex-1 mb-8 leading-relaxed">{role.description}</p>
                  <Link
                    href={role.href}
                    className={`inline-flex items-center gap-2 text-sm font-semibold transition-all active:scale-[0.98] ${c.text} group-hover:gap-3`}
                  >
                    {role.cta} <ArrowRight className="h-4 w-4" />
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* Featured Contracts */}
      {featuredContracts.length > 0 && (
        <section className="border-t border-border/50 bg-surface/30">
          <motion.div
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            variants={STAGGER_CONTAINER_VARIANTS}
          >
            <motion.div variants={FADE_UP_ANIMATION_VARIANTS} className="flex items-center justify-between mb-12">
              <h2 className="text-4xl font-bold tracking-tight">Featured Contracts</h2>
              <Link href="/marketplace" className="group flex items-center gap-2 text-sm font-medium text-accent hover:text-accent/80 transition-colors">
                View all <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </motion.div>
            <div className="grid md:grid-cols-3 gap-6">
              {featuredContracts.map((c) => (
                <motion.div variants={STAGGER_CHILD_VARIANTS} key={c.id}>
                  <Link href={`/marketplace/${c.id}`} className="block rounded-2xl border border-border/60 bg-surface p-8 transition-all hover:-translate-y-1 hover:shadow-xl hover:border-accent/40 group">
                    <div className="flex items-center justify-between mb-5">
                      <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-md bg-success/15 text-success border border-success/20">
                        Score: {c.score}
                      </span>
                      <span className="text-sm font-semibold text-muted font-mono">{c.value}</span>
                    </div>
                    <h3 className="font-semibold text-lg mb-1.5 tracking-tight group-hover:text-accent transition-colors">{c.title}</h3>
                    <p className="text-sm text-muted mb-6 tracking-tight">by {c.agency}</p>
                    <div className="mb-4">
                      <div className="flex justify-between text-xs font-medium text-muted mb-2 tracking-tight">
                        <span>Completion</span><span>{c.progress}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-default overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${c.progress}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                          className="h-full rounded-full bg-accent"
                        />
                      </div>
                    </div>
                    <div className="flex justify-between text-sm mt-6 pt-6 border-t border-border/50 font-medium">
                      <span className="text-muted">{c.tokenPrice}/token</span>
                      <span className="text-foreground">{c.tokensAvailable} available</span>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>
      )}

      {/* Architecture */}
      <section className="border-t border-border/50">
        <motion.div
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          variants={STAGGER_CONTAINER_VARIANTS}
        >
          <motion.h2 variants={FADE_UP_ANIMATION_VARIANTS} className="text-4xl font-bold tracking-tight text-center mb-4">Architecture</motion.h2>
          <motion.p variants={FADE_UP_ANIMATION_VARIANTS} className="text-muted text-center mb-16 max-w-2xl mx-auto tracking-tight text-lg">
            Three layers working together: security, liquidity, and justice
          </motion.p>
          <div className="grid md:grid-cols-3 gap-6">
            <motion.div variants={STAGGER_CHILD_VARIANTS} className="rounded-2xl border border-brand/30 bg-surface/50 backdrop-blur-sm p-8 shadow-[0_0_25px_rgba(var(--brand-raw),0.05)]">
              <div className="text-xs font-mono font-semibold text-brand mb-4 uppercase tracking-widest">Arbitrum</div>
              <h3 className="font-semibold text-xl mb-4 tracking-tight">Contract Layer</h3>
              <ul className="space-y-3 text-sm text-muted tracking-tight">
                <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-brand" /> Contract terms &amp; milestones</li>
                <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-brand" /> Escrow &amp; payment splits</li>
                <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-brand" /> Deliverable proofs</li>
                <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-brand" /> Agency reputation</li>
              </ul>
            </motion.div>
            <motion.div variants={STAGGER_CHILD_VARIANTS} className="rounded-2xl border border-accent/30 bg-surface/50 backdrop-blur-sm p-8 shadow-[0_0_25px_rgba(var(--accent-raw),0.05)]">
              <div className="text-xs font-mono font-semibold text-accent mb-4 uppercase tracking-widest">ERC20 Tokens</div>
              <h3 className="font-semibold text-xl mb-4 tracking-tight">Tradeable Layer</h3>
              <ul className="space-y-3 text-sm text-muted tracking-tight">
                <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-accent" /> Contract tokens (ERC20)</li>
                <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-accent" /> Marketplace listings</li>
                <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-accent" /> On-chain attestations</li>
                <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-accent" /> Agency reputation scores</li>
              </ul>
            </motion.div>
            <motion.div variants={STAGGER_CHILD_VARIANTS} className="rounded-2xl border border-warning/30 bg-surface/50 backdrop-blur-sm p-8 shadow-[0_0_25px_rgba(var(--warning-raw),0.05)]">
              <div className="text-xs font-mono font-semibold text-warning mb-4 uppercase tracking-widest">Kleros v2</div>
              <h3 className="font-semibold text-xl mb-4 tracking-tight">Justice Layer</h3>
              <ul className="space-y-3 text-sm text-muted tracking-tight">
                <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-warning" /> Decentralized court</li>
                <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-warning" /> Native on Arbitrum</li>
                <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-warning" /> Evidence-based rulings</li>
                <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-warning" /> Binding outcomes</li>
              </ul>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-12 bg-surface/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-muted">
          <div className="flex items-center gap-2.5">
            <SignalLogo size={24} className="rounded object-cover" />
            <span className="font-medium text-foreground tracking-tight">TrustSignal</span>
            <span className="hidden sm:inline tracking-tight">— Intellectual Deliverable Tokenization</span>
          </div>
          <div className="flex items-center gap-6 font-medium">
            <a href="https://x.com/thesignaldir" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-all hover:scale-105 active:scale-95">X (Twitter)</a>
            <a href="https://www.linkedin.com/company/105974279/" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-all hover:scale-105 active:scale-95">LinkedIn</a>
            <a href="https://t.me/thesignaldirectory#" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-all hover:scale-105 active:scale-95">Telegram</a>
            <a href="https://discord.com/invite/DyMtfph9rA" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-all hover:scale-105 active:scale-95">Discord</a>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 text-center md:text-left text-xs font-mono text-muted/50 tracking-widest uppercase">
          Built on Arbitrum | Kleros
        </div>
      </footer>
    </div>
  );
}
