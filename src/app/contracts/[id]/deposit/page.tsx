"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Wallet, Loader2, CheckCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { BrowserProvider, formatEther } from "ethers";
import { useContract, depositEscrow } from "@/hooks/use-contracts";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Button } from "@heroui/react";
import { PageHeader, SectionCard } from "@/components/ui";

export default function DepositPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { contract, escrow, loading } = useContract(id);
  const { walletAddress, authenticated } = useAuth();

  const [depositing, setDepositing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<"idle" | "sending" | "confirming" | "confirmed">("idle");
  const [walletBalance, setWalletBalance] = useState<string | null>(null);

  const totalRequired = contract?.totalValue ?? 0;
  const alreadyDeposited = escrow?.depositedAmount ?? 0;
  const remaining = Math.max(0, totalRequired - alreadyDeposited);

  // Fetch balance from the connected wallet via window.ethereum
  useEffect(() => {
    if (!walletAddress) return;
    const eth = (window as unknown as { ethereum?: unknown }).ethereum;
    if (!eth) return;

    (async () => {
      try {
        const provider = new BrowserProvider(eth as never);
        const balance = await provider.getBalance(walletAddress);
        setWalletBalance(formatEther(balance));
      } catch {
        // Balance fetch is optional
      }
    })();
  }, [walletAddress]);

  // Redirect if already funded
  const alreadyFunded = !loading && remaining <= 0 && !!contract;
  useEffect(() => {
    if (alreadyFunded) router.replace(`/contracts/${id}`);
  }, [alreadyFunded, router, id]);

  if (alreadyFunded) return null;

  const handleDeposit = async () => {
    setDepositing(true);
    setError(null);
    setTxStatus("sending");

    try {

      const result = await depositEscrow(id, {
        amount: remaining,
        paymentMethod: contract?.onChainAddress ? "crypto" : "db_only",
      });

      setTxStatus("confirmed");
      toast.success("Escrow deposited!");
      setTimeout(() => router.push(`/contracts/${id}`), 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Deposit failed";
      setError(message);
      toast.error(message);
      setTxStatus("idle");
      setDepositing(false);
    }
  };

  const isClient = contract && walletAddress &&
    contract.client?.toLowerCase() === walletAddress?.toLowerCase();

  if (!loading && contract && !isClient) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <PageHeader title="Deposit Escrow" backHref={`/contracts/${id}`} backLabel="Back" />
        <SectionCard>
          <p className="text-sm text-muted text-center py-8">Only the client can deposit escrow.</p>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <PageHeader
        title="Deposit Escrow"
        description="Lock funds to guarantee payment for the agency upon delivery"
        backHref={`/contracts/${id}`}
        backLabel="Back to Contract"
      />

      <SectionCard title={`Contract: ${contract?.title ?? "Loading..."}`} className="mb-6">
        <div className="flex justify-between text-sm">
          <span className="text-muted">Total Required</span>
          <span className="font-bold text-lg">${totalRequired.toLocaleString()}</span>
        </div>
        {alreadyDeposited > 0 && (
          <div className="flex justify-between text-sm mt-2">
            <span className="text-muted">Already Deposited</span>
            <span className="text-success">${alreadyDeposited.toLocaleString()}</span>
          </div>
        )}
      </SectionCard>

      <SectionCard className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Wallet className="h-5 w-5 text-accent" />
          <span className="font-medium">Connected Wallet</span>
        </div>
        {walletAddress ? (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Address</span>
              <span className="font-mono text-xs">{walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}</span>
            </div>
            {walletBalance !== null && (
              <div className="flex justify-between">
                <span className="text-muted">ETH Balance</span>
                <span>{parseFloat(walletBalance).toFixed(4)} ETH</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">Please sign in to deposit.</p>
        )}
      </SectionCard>

      <SectionCard className="mb-6">
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-border/50">
            <span className="text-muted">Amount to deposit</span>
            <span className="font-bold">${remaining.toLocaleString()}</span>
          </div>
        </div>
      </SectionCard>

      {txStatus === "confirmed" && (
        <div className="mb-4 p-4 rounded-lg bg-success/10 border border-success/20 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-success" />
          <span className="text-sm font-medium text-success">Deposit confirmed! Redirecting...</span>
        </div>
      )}

      {txStatus === "sending" && depositing && (
        <div className="mb-4 p-4 rounded-lg bg-accent/10 border border-accent/20 flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
          <span className="text-sm font-medium">Processing deposit...</span>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-danger/10 border border-danger/20">
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {remaining > 0 && txStatus !== "confirmed" && (
        <Button
          onPress={handleDeposit}
          isDisabled={depositing || loading || !authenticated}
          fullWidth
          className="py-4 rounded-xl bg-accent text-accent-foreground font-medium text-lg hover:bg-accent/80 transition-colors"
        >
          {depositing ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
          {depositing ? "Processing..." : `Deposit $${remaining.toLocaleString()}`}
        </Button>
      )}

      {remaining <= 0 && (
        <div className="space-y-4">
          <div className="p-5 rounded-xl bg-success/10 border border-success/20 flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-success" />
            <p className="font-semibold text-success">Escrow fully funded.</p>
          </div>
          <Link
            href={`/contracts/${id}`}
            className="flex items-center justify-center gap-2 h-12 rounded-xl bg-accent text-accent-foreground font-semibold"
          >
            Go to contract <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      )}
    </div>
  );
}
