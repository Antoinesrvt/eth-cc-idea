"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Coins, Loader2, CheckCircle, ExternalLink } from "lucide-react";
import { useContract, tokenizeContract } from "@/hooks/use-contracts";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Button, Input } from "@heroui/react";
import { PageHeader, SectionCard } from "@/components/ui";
import Link from "next/link";

type Step = "form" | "confirm" | "broadcasting" | "success";

export default function TokenizePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { contract, loading: contractLoading } = useContract(id);
  const { walletAddress } = useAuth();

  const totalValue = contract?.totalValue ?? 0;
  const contractTitle = contract?.title ?? "Contract";

  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [discountPct, setDiscountPct] = useState(10);
  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState<string | null>(null);

  const pricePerToken = Number((1 - discountPct / 100).toFixed(4));
  const totalSupply = totalValue;
  const investorCost = totalValue * pricePerToken;
  const investorYieldPct = discountPct > 0 ? ((1 / (1 - discountPct / 100) - 1) * 100) : 0;

  const defaultName = `${contractTitle.replace(/\s+/g, "-")}-Token`;
  const defaultSymbol = contractTitle.split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 4) || "TKN";

  const isAgency = contract?.agency?.toLowerCase() === walletAddress?.toLowerCase();

  const handleConfirm = async () => {
    setStep("broadcasting");
    setError(null);
    try {
      await tokenizeContract(id, {
        tokenName: tokenName || defaultName,
        tokenSymbol: tokenSymbol || defaultSymbol,
        totalSupply,
        pricePerToken,
      });
      toast.success("Contract tokenized!");
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tokenization failed");
      toast.error(err instanceof Error ? err.message : "Tokenization failed");
      setStep("confirm");
    }
  };

  if (step === "success") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <PageHeader title="Contract Tokenized!" backHref={`/contracts/${id}`} backLabel="Back" />
        <SectionCard className="text-center py-10">
          <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
          <p className="text-lg font-bold mb-2">{tokenName || defaultName}</p>
          <p className="text-sm text-muted mb-4">{totalSupply.toLocaleString()} tokens at ${pricePerToken.toFixed(2)} each</p>
          <Link href="/marketplace" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground font-medium">
            View on Marketplace <ExternalLink className="h-4 w-4" />
          </Link>
        </SectionCard>
      </div>
    );
  }

  if (step === "broadcasting") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <PageHeader title="Tokenizing..." backHref={`/contracts/${id}`} backLabel="Back" />
        <SectionCard className="text-center py-12">
          <Loader2 className="h-12 w-12 text-accent animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted">Creating Uniswap pool and minting tokens...</p>
        </SectionCard>
      </div>
    );
  }

  if (!contractLoading && !isAgency) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <PageHeader title="Tokenize Contract" backHref={`/contracts/${id}`} backLabel="Back" />
        <SectionCard>
          <p className="text-sm text-muted text-center py-8">Only the agency can tokenize this contract.</p>
        </SectionCard>
      </div>
    );
  }

  if (!contractLoading && contract?.status !== "active") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <PageHeader title="Tokenize Contract" backHref={`/contracts/${id}`} backLabel="Back" />
        <SectionCard>
          <p className="text-sm text-muted text-center py-8">Contract must be active (escrow deposited) before tokenizing.</p>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <PageHeader title="Tokenize Contract" description="Create tradeable tokens for investors on Uniswap" backHref={`/contracts/${id}`} backLabel="Back" />

      {step === "form" && (
        <>
          {/* Value overview */}
          <SectionCard title="Contract Value" icon={<Coins className="h-5 w-5 text-brand" />} className="mb-6">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-surface-secondary text-center">
                <p className="text-2xl font-bold">${totalValue.toLocaleString()}</p>
                <p className="text-xs text-muted mt-1">Contract Value</p>
              </div>
              <div className="p-4 rounded-xl bg-surface-secondary text-center">
                <p className="text-2xl font-bold text-accent">${investorCost.toLocaleString()}</p>
                <p className="text-xs text-muted mt-1">Investor Pays</p>
              </div>
              <div className="p-4 rounded-xl bg-surface-secondary text-center">
                <p className="text-2xl font-bold text-success">+{investorYieldPct.toFixed(1)}%</p>
                <p className="text-xs text-muted mt-1">Investor Yield</p>
              </div>
            </div>

            {/* Discount slider */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Investor Discount</label>
                <span className="text-sm font-bold text-accent">{discountPct}%</span>
              </div>
              <input type="range" min={1} max={50} value={discountPct} onChange={(e) => setDiscountPct(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer bg-surface-tertiary accent-accent" />
              <p className="text-xs text-muted mt-2">
                Investors buy at <strong>${pricePerToken.toFixed(2)}</strong>/token. You receive <strong>${investorCost.toLocaleString()}</strong> upfront.
              </p>
            </div>

            {/* Token details */}
            <div className="border-t border-border/50 pt-4 grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted mb-1 block">Token Name</label>
                <Input value={tokenName} onChange={(e) => setTokenName(e.target.value)} placeholder={defaultName} className="w-full" />
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">Token Symbol</label>
                <Input value={tokenSymbol} onChange={(e) => setTokenSymbol(e.target.value)} placeholder={defaultSymbol} className="w-full" />
              </div>
            </div>
          </SectionCard>

          <Button onPress={() => setStep("confirm")} fullWidth className="py-4 rounded-xl bg-accent text-foreground font-medium text-lg">
            Review & Tokenize
          </Button>
        </>
      )}

      {step === "confirm" && (
        <>
          <SectionCard title="Confirm Tokenization" className="mb-6">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted">Token</span>
                <span className="font-semibold">{tokenName || defaultName} ({tokenSymbol || defaultSymbol})</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted">Supply</span>
                <span className="font-semibold">{totalSupply.toLocaleString()} tokens</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted">Price</span>
                <span className="font-semibold">${pricePerToken.toFixed(2)} <span className="text-xs text-muted">(face $1.00)</span></span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted">Investor Yield</span>
                <span className="font-semibold text-success">+{investorYieldPct.toFixed(1)}%</span>
              </div>
            </div>
            <p className="text-xs text-muted mt-4">A Uniswap V3 pool will be created for this token paired with USDC.</p>
          </SectionCard>

          {error && (
            <div className="mb-4 p-4 rounded-lg bg-danger/10 border border-danger/20">
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <Button onPress={() => setStep("form")} variant="ghost" className="flex-1 py-3 rounded-xl border border-border">Cancel</Button>
            <Button onPress={handleConfirm} className="flex-1 py-3 rounded-xl bg-accent text-foreground font-medium">Confirm & Tokenize</Button>
          </div>
        </>
      )}
    </div>
  );
}
