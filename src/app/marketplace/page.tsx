"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowUpDown, SlidersHorizontal, Store } from "lucide-react";
import { useMarketplace, type MarketplaceListing } from "@/hooks/use-marketplace";
import { Card, CardContent, Button, Chip, Spinner, SearchField, Select, SelectTrigger, SelectValue, SelectIndicator, SelectPopover, ListBox } from "@heroui/react";
import { motion } from "framer-motion";
import { truncateMiddle, formatCurrency } from "@/lib/utils/format";
import { ScoreBadge } from "@/components/ui/score-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { LabeledProgress } from "@/components/ui/labeled-progress";
import { EmptyState } from "@/components/ui/empty-state";

// ─── Local display type ──────────────────────────────────────────────────────
type ActiveListing = {
  id: string;
  title: string;
  category: string;
  agency: string;
  agencyAddress: string;
  score: number;
  aiStatus: "Verified" | "Pending";
  value: string;
  tokenPrice: string;
  tokensAvailable: number;
  progress: number;
};

// ─── Animation variants ──────────────────────────────────────────────────────
const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 220, damping: 22 } } };

const CATEGORIES = ["All Categories", "Development", "Design", "Marketing", "Legal"];
const SCORE_FILTERS = [
  { label: "Any Score", min: 0 },
  { label: "Score: 80+", min: 80 },
  { label: "Score: 90+", min: 90 },
];

// ─── Sort ───────────────────────────────────────────────────────────────────
type SortOption = "default" | "score" | "value" | "progress";
const SORT_CYCLE: SortOption[] = ["default", "score", "value", "progress"];
const SORT_LABELS: Record<SortOption, string> = { default: "Sort", score: "Score", value: "Value", progress: "Progress" };

// ─── Component ───────────────────────────────────────────────────────────────
export default function MarketplacePage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [minScore, setMinScore] = useState(0);
  const [sortBy, setSortBy] = useState<SortOption>("default");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 6;

  const { listings, loading } = useMarketplace();

  const activeData = useMemo<ActiveListing[]>(() => {
    return listings.map((c: MarketplaceListing): ActiveListing => ({
      id: c.tokenId,
      title: c.title,
      category: c.category.charAt(0).toUpperCase() + c.category.slice(1),
      agency: c.agency.name ?? truncateMiddle(c.agency.address, 6, 4),
      agencyAddress: c.agency.address,
      score: c.avgScore ?? 0,
      aiStatus: c.status === "active" ? "Verified" : "Pending",
      value: formatCurrency(c.totalValue),
      tokenPrice: formatCurrency(c.totalValue / 10_000, "$"),
      tokensAvailable: Math.max(0, 10_000 - Math.round(c.progress * 100)),
      progress: Math.round((c.completedMilestones / Math.max(c.totalMilestones, 1)) * 100),
    }));
  }, [listings]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const result = activeData.filter((c) => {
      if (category !== "All Categories" && c.category !== category) return false;
      if (c.score < minScore) return false;
      if (q && !c.title.toLowerCase().includes(q) && !c.agency.toLowerCase().includes(q)) return false;
      return true;
    });
    if (sortBy === "score") result.sort((a, b) => b.score - a.score);
    else if (sortBy === "value") result.sort((a, b) => parseFloat(b.value.replace(/[$,]/g, "")) - parseFloat(a.value.replace(/[$,]/g, "")));
    else if (sortBy === "progress") result.sort((a, b) => b.progress - a.progress);
    return result;
  }, [search, category, minScore, sortBy, activeData]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

      {/* Page header */}
      <div className="mb-10 text-center max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold tracking-tight mb-3">
          Contract <span className="text-accent">Marketplace</span>
        </h1>
        <p className="text-muted text-base">
          Invest in high-yield agency contracts powered by AI-verified milestones and decentralised escrow.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-8 bg-surface border border-border rounded-xl p-3 shadow-sm">
        {/* Search */}
        <div className="flex-1">
          <SearchField
            aria-label="Search contracts"
            value={search}
            onChange={(val) => { setSearch(val); setPage(1); }}
            className="w-full"
          >
            <SearchField.Group className="bg-surface-secondary border border-border rounded-lg px-3 py-2 focus-within:border-accent transition-colors">
              <SearchField.SearchIcon className="h-4 w-4 text-muted shrink-0" />
              <SearchField.Input className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted outline-none" placeholder="Search contracts or agencies…" />
              <SearchField.ClearButton className="text-muted hover:text-foreground" />
            </SearchField.Group>
          </SearchField>
        </div>

        {/* Category */}
        <Select
          aria-label="Category"
          selectedKey={category}
          onSelectionChange={(key) => { setCategory(key as string); setPage(1); }}
        >
          <SelectTrigger className="bg-surface-secondary border border-border text-foreground text-sm rounded-lg px-3 py-2 outline-none hover:border-accent/50 focus:border-accent transition-colors min-w-[160px] flex items-center justify-between gap-2">
            <SelectValue />
            <SelectIndicator />
          </SelectTrigger>
          <SelectPopover className="bg-surface border border-border rounded-lg shadow-lg">
            <ListBox className="p-1 outline-none">
              {CATEGORIES.map((c) => (
                <ListBox.Item key={c} id={c} className="px-3 py-2 text-sm rounded cursor-pointer hover:bg-surface-secondary outline-none focus:bg-surface-secondary selected:bg-accent/10 selected:text-accent">{c}</ListBox.Item>
              ))}
            </ListBox>
          </SelectPopover>
        </Select>

        {/* Score */}
        <Select
          aria-label="Minimum score"
          selectedKey={String(minScore)}
          onSelectionChange={(key) => { setMinScore(Number(key)); setPage(1); }}
        >
          <SelectTrigger className="bg-surface-secondary border border-border text-foreground text-sm rounded-lg px-3 py-2 outline-none hover:border-accent/50 focus:border-accent transition-colors min-w-[140px] flex items-center justify-between gap-2">
            <SelectValue />
            <SelectIndicator />
          </SelectTrigger>
          <SelectPopover className="bg-surface border border-border rounded-lg shadow-lg">
            <ListBox className="p-1 outline-none">
              {SCORE_FILTERS.map((f) => (
                <ListBox.Item key={String(f.min)} id={String(f.min)} className="px-3 py-2 text-sm rounded cursor-pointer hover:bg-surface-secondary outline-none focus:bg-surface-secondary selected:bg-accent/10 selected:text-accent">{f.label}</ListBox.Item>
              ))}
            </ListBox>
          </SelectPopover>
        </Select>

        <Button
          variant="secondary"
          className="shrink-0 gap-2"
          onPress={() => {
            const idx = SORT_CYCLE.indexOf(sortBy);
            setSortBy(SORT_CYCLE[(idx + 1) % SORT_CYCLE.length]);
            setPage(1);
          }}
        >
          <ArrowUpDown className="h-4 w-4" /> {SORT_LABELS[sortBy]}
        </Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-20">
          <Spinner size="lg" className="text-accent" />
        </div>
      )}

      {/* Grid */}
      {!loading && (
        <>
          {activeData.length === 0 ? (
            <EmptyState
              icon={<Store className="h-12 w-12" />}
              title="No contracts tokenized yet"
              description="No contracts tokenized yet. Be the first agency to tokenize."
              action={
                <Link
                  href="/contracts/new"
                  className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-accent text-accent-foreground font-medium shadow-sm active:scale-[0.98] transition-all"
                >
                  Create Contract
                </Link>
              }
            />
          ) : (
            <>
              <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" initial="hidden" animate="show" variants={container}>
                {paged.map((c) => (
                  <motion.div key={c.id} variants={item}>
                    <Link href={`/marketplace/${c.id}`} className="block h-full group outline-none">
                      <Card className="h-full flex flex-col bg-surface border border-border rounded-xl shadow-sm hover:border-accent/40 hover:shadow-[0_8px_28px_rgba(var(--accent-rgb,99,102,241),0.12)] hover:-translate-y-0.5 transition-all duration-300">
                        <CardContent className="flex flex-col flex-1 gap-4 p-5">

                          {/* Top row */}
                          <div className="flex items-start justify-between gap-2">
                            <Chip size="sm" variant="soft" className="text-xs font-semibold shrink-0">{c.category}</Chip>
                            <StatusBadge status={c.aiStatus === "Verified" ? "approved" : "pending"} />
                          </div>

                          {/* Title */}
                          <div>
                            <h3 className="font-bold text-base leading-snug line-clamp-2 group-hover:text-accent transition-colors">{c.title}</h3>
                            <p className="text-xs text-muted mt-1 truncate">
                              by <span className="font-semibold text-foreground">{c.agency}</span>
                              {c.agencyAddress && (
                                <span className="ml-1 font-mono text-muted/60">{truncateMiddle(c.agencyAddress, 4, 4)}</span>
                              )}
                            </p>
                          </div>

                          {/* Score + value */}
                          <div className="flex items-center gap-2">
                            <ScoreBadge score={c.score} />
                            <span className="text-muted text-xs">·</span>
                            <span className="text-sm font-bold text-foreground">{c.value}</span>
                          </div>

                          {/* Progress */}
                          <LabeledProgress label="Completion" value={c.progress} color="accent" />

                          {/* Footer */}
                          <div className="mt-auto flex items-center justify-between pt-3 border-t border-border/60">
                            <div>
                              <span className="text-base font-bold text-foreground">{c.tokenPrice}</span>
                              <span className="text-xs text-muted font-normal ml-0.5">/token</span>
                            </div>
                            <span className="text-xs text-muted tabular-nums">
                              {c.tokensAvailable.toLocaleString()} available
                            </span>
                          </div>

                        </CardContent>
                      </Card>
                    </Link>
                  </motion.div>
                ))}
              </motion.div>

              {/* Empty filter state */}
              {filtered.length === 0 && (
                <div className="text-center py-20 space-y-4">
                  <SlidersHorizontal className="h-10 w-10 text-muted mx-auto" />
                  <p className="text-muted font-medium">No contracts match your filters.</p>
                  <Button variant="ghost" onPress={() => { setSearch(""); setCategory("All Categories"); setMinScore(0); }}>
                    Clear filters
                  </Button>
                </div>
              )}

              {/* Pagination */}
              {filtered.length > PAGE_SIZE && (
                <div className="flex items-center justify-between mt-10 bg-surface border border-border rounded-xl px-4 py-3">
                  <Button variant="ghost" isDisabled={page <= 1} onPress={() => setPage(p => p - 1)}>← Previous</Button>
                  <span className="text-sm text-muted tabular-nums">Page {page} of {totalPages}</span>
                  <Button variant="ghost" isDisabled={page >= totalPages} onPress={() => setPage(p => p + 1)}>Next →</Button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
