"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  PlusCircle,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Store,
  Search,
  UserCircle,
  ExternalLink,
  XCircle,
  Briefcase,
  Users,
  TrendingUp,
} from "lucide-react";
import { useApi } from "@/hooks/use-api";
import { useAuth } from "@/hooks/use-auth";
import { Button, Card, CardContent, Chip, Spinner } from "@heroui/react";
import {
  StatCard,
  StatusBadge,
  LabeledProgress,
  SectionCard,
  EmptyState,
} from "@/components/ui";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MarketplaceListing {
  tokenId: string;
  title: string;
  status: string;
  progress: number;
  agency: {
    address: string;
    name: string | null;
  };
}

interface InvestorHolding {
  tokenAddress: string;
  contractId: string;
  amount: number;
  buyPrice: number;
  currentPrice: number;
}

interface InvestmentRow {
  contractId: string;
  tokenAddress: string;
  title: string;
  agencyName: string | null;
  agencyAddress: string;
  amount: number;
  buyPrice: number;
  currentPrice: number;
  status: string;
  progress: number;
}

interface ActionItem {
  id: string;
  type: "approval" | "deliverable" | "dispute" | "rejection" | "deposit";
  title: string;
  subtitle: string;
  role: string;
  href: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

interface DashboardContract {
  id: string;
  title: string;
  description: string;
  category: string;
  client: string;
  agency: string;
  status: string;
  totalValue: number;
  milestones: { id: number; name: string; status: string; amount: number }[];
  tokenAddress?: string;
}

function computeProgress(c: DashboardContract): number {
  if (!c.milestones || c.milestones.length === 0) return 0;
  const approved = c.milestones.filter((m) => m.status === "approved").length;
  return Math.round((approved / c.milestones.length) * 100);
}

function formatCurrency(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/* ------------------------------------------------------------------ */
/*  Discover cards config                                              */
/* ------------------------------------------------------------------ */

const discoverCards = [
  {
    icon: <Store className="h-6 w-6 text-accent" />,
    title: "Browse Investments",
    subtitle: "Explore tokenized contracts on the marketplace",
    href: "/marketplace",
    external: false,
  },
  {
    icon: <Search className="h-6 w-6 text-accent" />,
    title: "Find an Agency",
    subtitle: "Find verified agencies on The Signal Directory",
    href: "https://thesignal.directory",
    external: true,
  },
  {
    icon: <PlusCircle className="h-6 w-6 text-accent" />,
    title: "Create Contract",
    subtitle: "Start a new service agreement",
    href: "/contracts/new",
    external: false,
  },
  {
    icon: <UserCircle className="h-6 w-6 text-accent" />,
    title: "View Profile",
    subtitle: "View your reputation, achievements & history",
    href: "/profile",
    external: false,
  },
];

/* ------------------------------------------------------------------ */
/*  Contract row sub-component                                         */
/* ------------------------------------------------------------------ */

function ContractRow({
  id,
  title,
  counterpartyLabel,
  counterparty,
  progress,
  status,
}: {
  id: string;
  title: string;
  counterpartyLabel: string;
  counterparty: string | null;
  progress: number;
  status: string;
}) {
  return (
    <Link
      href={`/contracts/${id}`}
      className="flex items-center justify-between px-6 py-4 hover:bg-surface-secondary transition-colors group"
    >
      <div className="flex items-center gap-4 min-w-0">
        <div
          className={`h-2.5 w-2.5 rounded-full shrink-0 ${
            status === "active"
              ? "bg-success shadow-[0_0_8px_theme(colors.success)]"
              : status === "completed"
                ? "bg-success"
                : "bg-muted"
          }`}
        />
        <div className="min-w-0">
          <span className="font-semibold text-sm text-foreground truncate block">
            {title}
          </span>
          <div className="text-xs text-muted mt-0.5">
            {counterpartyLabel}:{" "}
            {counterparty ? (
              <span className="font-mono">{counterparty}</span>
            ) : (
              <span className="italic">Private</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <div className="w-28 hidden sm:block">
          <LabeledProgress value={progress} showValue={false} color="accent" />
        </div>
        <span className="text-xs text-muted font-mono w-10 text-right">
          {progress}%
        </span>
        <StatusBadge
          status={
            status as "active" | "completed" | "draft" | "disputed" | "failed"
          }
        />
        <ArrowRight className="h-4 w-4 text-muted group-hover:text-accent group-hover:translate-x-1 transition-all" />
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Section heading sub-component                                      */
/* ------------------------------------------------------------------ */

function SectionHeading({
  icon,
  label,
  count,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-muted">{icon}</span>
      <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
        {label}
      </h2>
      <Chip size="sm" variant="soft" color="default" className="ml-1">
        {count}
      </Chip>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const { walletAddress, authenticated, login, ready } = useAuth();

  /* Fetch all contracts where this user is a party — only when authed */
  const contractsUrl = walletAddress
    ? `/api/contracts?user=${encodeURIComponent(walletAddress)}`
    : null;
  const { data: allContracts, loading: contractsLoading } =
    useApi<DashboardContract[]>(contractsUrl);

  /* Fetch marketplace listings so we can match investor holdings */
  const { data: marketplaceListings } = useApi<MarketplaceListing[]>(
    walletAddress ? "/api/marketplace" : null,
  );

  /* ---- Derive role-based contract groups ---- */
  const agencyContracts = useMemo<DashboardContract[]>(() => {
    if (!allContracts || !walletAddress) return [];
    return allContracts.filter(
      (c) => c.agency?.toLowerCase() === walletAddress.toLowerCase(),
    );
  }, [allContracts, walletAddress]);

  const clientContracts = useMemo<DashboardContract[]>(() => {
    if (!allContracts || !walletAddress) return [];
    return allContracts.filter(
      (c) => c.client?.toLowerCase() === walletAddress.toLowerCase(),
    );
  }, [allContracts, walletAddress]);

  /* ---- Investments: not yet available (holdings DB not wired) ---- */
  const investments = useMemo<InvestmentRow[]>(() => {
    // Holdings DB not available yet — Uniswap integration coming soon
    return [];
  }, []);

  /* ---- Quick stats (across all roles) ---- */
  const allMyContracts = useMemo(
    () => [...agencyContracts, ...clientContracts],
    [agencyContracts, clientContracts],
  );

  const activeContracts = useMemo(
    () =>
      allMyContracts.filter(
        (c) => c.status === "active" || c.status === "disputed",
      ).length,
    [allMyContracts],
  );

  const pendingActions = useMemo(() => {
    if (!walletAddress) return 0;
    let count = 0;

    agencyContracts.forEach((c) => {
      c.milestones.forEach((m) => {
        if (m.status === "pending") count++; // Submit deliverable
        if (m.status === "rejected") count++; // Respond to rejection
      });
      if (c.status === "disputed") count++;
    });

    clientContracts.forEach((c) => {
      c.milestones.forEach((m) => {
        if (m.status === "delivered") count++; // Approve or Reject
      });
      if (c.status === "disputed") count++;
    });

    return count;
  }, [agencyContracts, clientContracts, walletAddress]);

  /* Escrow locked: only sum contracts where user is client (they paid) */
  const escrowLocked = useMemo(() => {
    return clientContracts
      .filter((c) => c.status === "active" || c.status === "disputed")
      .reduce((sum, c) => {
        const released = c.milestones
          .filter((m) => m.status === "approved")
          .reduce((s, m) => s + m.amount, 0);
        return sum + (c.totalValue - released);
      }, 0);
  }, [clientContracts]);

  /* ---- Action items with role context ---- */
  const actionItems = useMemo<ActionItem[]>(() => {
    const items: ActionItem[] = [];

    agencyContracts.forEach((c) => {
      c.milestones.forEach((m) => {
        if (m.status === "pending") {
          items.push({
            id: `${c.id}-${m.id}-deliver`,
            type: "deliverable",
            title: `Deliver: ${m.name}`,
            subtitle: c.title,
            role: "as Agency",
            href: `/contracts/${c.id}`,
          });
        }
        if (m.status === "rejected") {
          items.push({
            id: `${c.id}-${m.id}-rejection`,
            type: "rejection",
            title: `Respond to Rejection: ${m.name}`,
            subtitle: c.title,
            role: "as Agency",
            href: `/contracts/${c.id}`,
          });
        }
      });
      if (c.status === "disputed") {
        items.push({
          id: `${c.id}-dispute-agency`,
          type: "dispute",
          title: `Dispute: ${c.title}`,
          subtitle: "Requires your attention",
          role: "as Agency",
          href: `/contracts/${c.id}`,
        });
      }
    });

    clientContracts.forEach((c) => {
      c.milestones.forEach((m) => {
        if (m.status === "delivered") {
          items.push({
            id: `${c.id}-${m.id}-approve`,
            type: "approval",
            title: `Approve or Reject: ${m.name}`,
            subtitle: c.title,
            role: "as Client",
            href: `/contracts/${c.id}`,
          });
        }
      });
      if (c.status === "disputed") {
        items.push({
          id: `${c.id}-dispute-client`,
          type: "dispute",
          title: `Dispute: ${c.title}`,
          subtitle: "Requires your attention",
          role: "as Client",
          href: `/contracts/${c.id}`,
        });
      }
    });

    return items;
  }, [agencyContracts, clientContracts]);

  /* ---- Icon / border helpers ---- */
  const actionIcon = (type: ActionItem["type"]) => {
    switch (type) {
      case "approval":
        return <Clock className="h-4 w-4 text-warning" />;
      case "deliverable":
        return <FileText className="h-4 w-4 text-accent" />;
      case "rejection":
        return <XCircle className="h-4 w-4 text-warning" />;
      case "dispute":
        return <AlertTriangle className="h-4 w-4 text-danger" />;
      case "deposit":
        return <Clock className="h-4 w-4 text-warning" />;
    }
  };

  const actionBorderColor = (type: ActionItem["type"]) => {
    switch (type) {
      case "approval":
        return "border-l-warning";
      case "deliverable":
        return "border-l-accent";
      case "rejection":
        return "border-l-warning";
      case "dispute":
        return "border-l-danger";
      case "deposit":
        return "border-l-warning";
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Loading state                                                    */
  /* ---------------------------------------------------------------- */

  /* contractsLoading will be true forever when url is null (unauthenticated).
     Only treat it as loading when we actually have a URL to fetch. */
  const isLoading = !ready || (!!contractsUrl && contractsLoading);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex justify-center py-24">
          <Spinner className="text-accent" />
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Unauthenticated state                                            */
  /* ---------------------------------------------------------------- */

  if (!authenticated || !walletAddress) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <EmptyState
          icon={<UserCircle className="h-12 w-12" />}
          title="Sign in to see your dashboard"
          description="Connect your wallet to view your contracts, actions, and investments."
          action={
            <Button
              onPress={() => login()}
              className="bg-accent text-accent-foreground font-medium"
            >
              Connect Wallet
            </Button>
          }
        />
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Authenticated dashboard                                          */
  /* ---------------------------------------------------------------- */

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1 tracking-tight">Dashboard</h1>
          <p className="text-muted text-sm">
            Your work hub &mdash; contracts, actions, and investments
          </p>
        </div>
        <Link
          href="/contracts/new"
          className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-accent text-accent-foreground font-medium shadow-md shadow-accent/20 active:scale-[0.98] transition-all"
        >
          <PlusCircle className="h-4 w-4" /> New Contract
        </Link>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/*  Quick Stats Row                                                 */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <StatCard
          value={activeContracts}
          label="Active Contracts"
          color="accent"
        />
        <StatCard
          value={pendingActions}
          label="Pending Actions"
          color="warning"
        />
        <StatCard
          value={formatCurrency(escrowLocked)}
          label="Escrow Locked"
        />
      </div>

      {/* ---------------------------------------------------------------- */}
      {/*  Action Required Section                                         */}
      {/* ---------------------------------------------------------------- */}
      {actionItems.length > 0 ? (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
            Action Required
          </h2>
          <div className="space-y-2">
            {actionItems.map((item) => (
              <Link key={item.id} href={item.href}>
                <div
                  className={`flex items-center gap-4 p-4 rounded-lg border border-border border-l-4 ${actionBorderColor(item.type)} bg-surface hover:bg-surface-secondary transition-colors group`}
                >
                  {actionIcon(item.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {item.title}
                    </p>
                    <p className="text-xs text-muted">
                      {item.subtitle}
                      <span className="ml-2 text-muted/60">({item.role})</span>
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted group-hover:text-accent group-hover:translate-x-1 transition-all shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-8 flex items-center gap-3 p-4 rounded-lg border border-border bg-surface">
          <CheckCircle2 className="h-5 w-5 text-success" />
          <p className="text-sm text-muted">
            All caught up! No pending actions.
          </p>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/*  As Agency                                                       */}
      {/* ---------------------------------------------------------------- */}
      <div className="mb-8">
        <SectionHeading
          icon={<Briefcase className="h-4 w-4" />}
          label="As Agency"
          count={agencyContracts.length}
        />
        <SectionCard
          action={
            <Link
              href="/contracts/new"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent/80 transition-colors"
            >
              <PlusCircle className="h-3.5 w-3.5" /> New Contract
            </Link>
          }
        >
          {agencyContracts.length > 0 ? (
            <div className="divide-y divide-border/50 -mx-6 -mb-4">
              {agencyContracts.map((c) => (
                <ContractRow
                  key={c.id}
                  id={c.id}
                  title={c.title}
                  counterpartyLabel="Client"
                  counterparty={null}
                  progress={computeProgress(c)}
                  status={c.status}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Briefcase className="h-10 w-10" />}
              title="No agency contracts yet"
              description="Create your first contract to start earning."
              action={
                <Link
                  href="/contracts/new"
                  className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md bg-accent text-accent-foreground text-sm font-medium active:scale-[0.98] transition-all"
                >
                  <PlusCircle className="h-4 w-4" /> Create Contract
                </Link>
              }
            />
          )}
        </SectionCard>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/*  As Client                                                       */}
      {/* ---------------------------------------------------------------- */}
      <div className="mb-8">
        <SectionHeading
          icon={<Users className="h-4 w-4" />}
          label="As Client"
          count={clientContracts.length}
        />
        <SectionCard>
          {clientContracts.length > 0 ? (
            <div className="divide-y divide-border/50 -mx-6 -mb-4">
              {clientContracts.map((c) => (
                <ContractRow
                  key={c.id}
                  id={c.id}
                  title={c.title}
                  counterpartyLabel="Agency"
                  counterparty={
                    c.agency ? truncateAddress(c.agency) : null
                  }
                  progress={computeProgress(c)}
                  status={c.status}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Users className="h-10 w-10" />}
              title="No client contracts yet"
              description="No contracts yet. Hire an agency or accept an invitation."
              action={
                <Link
                  href="/marketplace"
                  className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md border border-border text-sm font-medium hover:bg-surface-secondary transition-all"
                >
                  <Store className="h-4 w-4" /> Browse Marketplace
                </Link>
              }
            />
          )}
        </SectionCard>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/*  Investments                                                     */}
      {/* ---------------------------------------------------------------- */}
      <div className="mb-8">
        <SectionHeading
          icon={<TrendingUp className="h-4 w-4" />}
          label="Investments"
          count={investments.length}
        />
        <SectionCard>
          {investments.length > 0 ? (
            <div className="divide-y divide-border/50 -mx-6 -mb-4">
              {investments.map((inv) => (
                <Link
                  key={inv.contractId}
                  href={`/marketplace/${inv.contractId}`}
                  className="flex items-center justify-between px-6 py-4 hover:bg-surface-secondary transition-colors group"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="min-w-0">
                      <span className="font-semibold text-sm text-foreground truncate block">
                        {inv.title}
                      </span>
                      <div className="text-xs text-muted mt-0.5">
                        Agency:{" "}
                        <span className="font-mono">
                          {inv.agencyName ?? truncateAddress(inv.agencyAddress)}
                        </span>
                        <span className="mx-1.5">·</span>
                        {inv.amount.toLocaleString()} tokens
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right hidden sm:block">
                      <div className="text-xs font-semibold text-foreground">
                        {formatCurrency(inv.amount * inv.currentPrice)}
                      </div>
                      <div className="text-xs text-muted">
                        {inv.currentPrice > inv.buyPrice ? (
                          <span className="text-success">
                            +
                            {(
                              ((inv.currentPrice - inv.buyPrice) /
                                inv.buyPrice) *
                              100
                            ).toFixed(1)}
                            %
                          </span>
                        ) : inv.currentPrice < inv.buyPrice ? (
                          <span className="text-danger">
                            {(
                              ((inv.currentPrice - inv.buyPrice) /
                                inv.buyPrice) *
                              100
                            ).toFixed(1)}
                            %
                          </span>
                        ) : (
                          <span>0.0%</span>
                        )}
                      </div>
                    </div>
                    <div className="w-28 hidden sm:block">
                      <LabeledProgress
                        value={inv.progress}
                        showValue={false}
                        color="accent"
                      />
                    </div>
                    <StatusBadge
                      status={
                        inv.status as
                          | "active"
                          | "completed"
                          | "draft"
                          | "disputed"
                          | "failed"
                      }
                    />
                    <ArrowRight className="h-4 w-4 text-muted group-hover:text-accent group-hover:translate-x-1 transition-all" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<TrendingUp className="h-10 w-10" />}
              title="No investments yet"
              description="Browse tokenized contracts on the marketplace to start earning yield."
              action={
                <Link
                  href="/marketplace"
                  className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md border border-border text-sm font-medium hover:bg-surface-secondary transition-all"
                >
                  <Store className="h-4 w-4" /> Browse Marketplace
                </Link>
              }
            />
          )}
        </SectionCard>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/*  Discover Section                                                */}
      {/* ---------------------------------------------------------------- */}
      <div>
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
          Discover
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {discoverCards.map((card) => {
            const content = (
              <Card className="border border-border hover:border-accent/40 transition-all cursor-pointer group h-full">
                <CardContent className="p-5 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    {card.icon}
                    {card.external && (
                      <ExternalLink className="h-3 w-3 text-muted ml-auto" />
                    )}
                  </div>
                  <p className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors">
                    {card.title}
                  </p>
                  <p className="text-xs text-muted">{card.subtitle}</p>
                </CardContent>
              </Card>
            );

            if (card.external) {
              return (
                <a
                  key={card.href}
                  href={card.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {content}
                </a>
              );
            }

            return (
              <Link key={card.href} href={card.href}>
                {content}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
