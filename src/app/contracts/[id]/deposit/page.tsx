"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Wallet, Shield, ShieldAlert, Loader2, AlertTriangle, CheckCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useWallets } from "@privy-io/react-auth";
import { BrowserProvider, parseEther } from "ethers";
import { useContract, depositEscrow } from "@/hooks/use-contracts";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Button } from "@heroui/react";
import { PageHeader, SectionCard } from "@/components/ui";

export default function DepositPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { contract, escrow, loading } = useContract(id);
  const { walletAddress, authenticated, getAuthToken } = useAuth();
  const { wallets, ready: walletsReady } = useWallets();
  // Use embedded wallet first, fall back to any connected wallet (Rabby, MetaMask, etc.)
  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy")
    ?? wallets.find((w) => w.connectorType === "injected")
    ?? wallets[0]
    ?? null;

  // Debug: log wallet state so we can diagnose issues
  useEffect(() => {
    console.log("[deposit] Wallets ready:", walletsReady, "Count:", wallets.length);
    wallets.forEach((w, i) => {
      console.log(`[deposit] Wallet ${i}:`, w.walletClientType, w.connectorType, w.address?.slice(0, 10));
    });
  }, [wallets, walletsReady]);

  const [depositing, setDepositing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<"idle" | "sending" | "confirming" | "confirmed">("idle");
  const [walletBalance, setWalletBalance] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const totalRequired = contract?.totalValue ?? 0;
  const alreadyDeposited = escrow?.depositedAmount ?? 0;
  const remaining = Math.max(0, totalRequired - alreadyDeposited);
  const platformFeeAmount = remaining * 0.01;
  const total = remaining + platformFeeAmount;

  // If escrow is already fully funded, redirect back to contract page
  const alreadyFunded = !loading && remaining <= 0 && !!contract;
  useEffect(() => {
    if (alreadyFunded) {
      router.replace(`/contracts/${id}`);
    }
  }, [alreadyFunded, router, id]);

  // Fetch wallet balance from the chain
  useEffect(() => {
    const addr = embeddedWallet?.address || walletAddress;
    if (!addr) return;

    let cancelled = false;
    setBalanceLoading(true);

    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc";

    fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getBalance",
        params: [addr, "latest"],
        id: 1,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.result) {
          const bal = parseInt(data.result, 16) / 1e18;
          setWalletBalance(bal.toString());
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setBalanceLoading(false);
      });

    return () => { cancelled = true; };
  }, [embeddedWallet, walletAddress]);

  const hasOnChainAddress = !!contract?.onChainAddress;

  // Render nothing while redirect is pending
  if (alreadyFunded) return null;

  const hasInsufficientBalance =
    walletBalance !== null && parseFloat(walletBalance) < total;

  const handleDeposit = async () => {
    setDepositing(true);
    setError(null);

    try {
      let txHash = `deposit_${Date.now().toString(36)}`;
      setTxStatus("sending");

      // If contract is on-chain and wallet is available, send the transaction
      if (contract?.onChainAddress && embeddedWallet) {
        const provider = await embeddedWallet.getEthereumProvider();
        const ethersProvider = new BrowserProvider(provider);
        const signer = await ethersProvider.getSigner();
        const depositAmount = parseEther(remaining.toString());

        const tx = await signer.sendTransaction({
          to: contract.onChainAddress,
          value: depositAmount,
          data: "0x98ea5fca", // depositEscrow()
        });

        setTxStatus("confirming");
        const receipt = await tx.wait();
        txHash = receipt!.hash;
      }

      setTxStatus("confirmed");

      // Record deposit in DB
      const token = await getAuthToken();
      await depositEscrow(id, {
        amount: remaining,
        txHash,
        paymentMethod: contract?.onChainAddress ? "crypto" : "db_only",
      }, token, walletAddress);

      toast.success("Escrow deposited!");

      setTimeout(() => {
        router.push(`/contracts/${id}`);
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Deposit failed";
      if (message.includes("rejected") || message.includes("denied")) {
        setError("Transaction rejected in your wallet.");
        toast.error("Transaction rejected.");
      } else if (message.includes("insufficient")) {
        setError("Insufficient balance. Please ensure you have enough funds.");
        toast.error("Insufficient balance.");
      } else {
        setError(message);
        toast.error(message);
      }
      setTxStatus("idle");
      setDepositing(false);
    }
  };

  const contractTitle = contract?.title ?? "Loading...";

  // Only the contract's client can deposit
  const isClient = contract && walletAddress && contract.client?.toLowerCase() === walletAddress?.toLowerCase();
  if (!loading && contract && !isClient) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <PageHeader
          title="Access Denied"
          description="Only the contract client can deposit escrow"
          backHref={`/contracts/${id}`}
          backLabel="Back to Contract"
        />
        <div className="p-6 rounded-xl bg-danger/10 border border-danger/20 text-center">
          <ShieldAlert className="h-8 w-8 text-danger mx-auto mb-3" />
          <p className="text-sm text-danger font-medium">
            {!authenticated
              ? "Please sign in to access this page."
              : "Your wallet address does not match the client of this contract."}
          </p>
        </div>
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

      {/* Contract Summary */}
      <SectionCard title={`Contract: ${contractTitle}`} className="mb-6">
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

      {/* Wallet Info */}
      <SectionCard className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Wallet className="h-5 w-5 text-accent" />
          <span className="font-medium">Wallet</span>
        </div>

        {!walletsReady ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Detecting wallets...</span>
          </div>
        ) : embeddedWallet ? (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Address</span>
              <span className="font-mono text-xs">
                {embeddedWallet.address.slice(0, 8)}...{embeddedWallet.address.slice(-6)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Type</span>
              <span className="text-xs text-muted">{embeddedWallet.walletClientType || embeddedWallet.connectorType || "wallet"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Balance</span>
              {balanceLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted" />
              ) : walletBalance !== null ? (
                <span className={hasInsufficientBalance ? "text-danger font-bold" : ""}>
                  {parseFloat(walletBalance).toFixed(4)} ETH
                </span>
              ) : (
                <span className="text-muted">--</span>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">
            No wallet detected. Please sign in first — a wallet will be created automatically.
          </p>
        )}

        {hasInsufficientBalance && (
          <div className="mt-3 p-3 rounded-lg bg-warning/10 border border-warning/20 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-medium text-warning">Insufficient balance</p>
              <p className="text-muted mt-1">
                You need {total.toFixed(4)} ETH but only have {parseFloat(walletBalance!).toFixed(4)} ETH.
              </p>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Summary */}
      <SectionCard className="mb-6">
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-border/50">
            <span className="text-muted">Escrow Amount</span>
            <span>${remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border/50">
            <span className="text-muted">Platform Fee (1%)</span>
            <span>${platformFeeAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between py-2 font-bold">
            <span>Total</span>
            <span>${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </SectionCard>

      {/* Transaction Status */}
      {txStatus !== "idle" && (
        <div className={`mb-4 p-4 rounded-lg flex items-center gap-3 ${
          txStatus === "confirmed"
            ? "bg-success/10 border border-success/20"
            : "bg-accent/10 border border-accent/20"
        }`}>
          {txStatus === "confirmed" ? (
            <>
              <div className="h-5 w-5 rounded-full bg-success flex items-center justify-center">
                <span className="text-white text-xs font-bold">&#10003;</span>
              </div>
              <span className="text-sm font-medium text-success">
                Transaction confirmed! Redirecting...
              </span>
            </>
          ) : (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-accent" />
              <span className="text-sm font-medium">
                {txStatus === "sending" ? "Sending transaction..." : "Waiting for confirmation..."}
              </span>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-danger/10 border border-danger/20">
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {remaining <= 0 ? (
        <div className="space-y-4">
          <div className="p-5 rounded-xl bg-success/10 border border-success/20 flex items-start gap-3">
            <CheckCircle className="h-6 w-6 text-success shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-success">Escrow fully funded. Contract is active.</p>
              {contract && (contract.status === "draft" || contract.status === "pending_deposit") && (
                <p className="text-sm text-success/80 mt-1">
                  Deposit recorded. Contract will activate shortly.
                </p>
              )}
            </div>
          </div>
          <Link
            href={`/contracts/${id}`}
            className="flex items-center justify-center gap-2 h-12 rounded-xl bg-accent text-accent-foreground font-semibold text-base hover:opacity-90 active:scale-[0.98] transition-all"
          >
            Go to contract <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      ) : (
        <div>
          <Button
            onPress={handleDeposit}
            isDisabled={depositing || loading || (hasOnChainAddress && !embeddedWallet)}
            fullWidth
            className="py-4 rounded-xl bg-accent text-foreground font-medium text-lg hover:bg-accent/80 transition-colors disabled:opacity-50"
          >
            {depositing && <Loader2 className="h-5 w-5 animate-spin" />}
            {depositing
              ? "Processing..."
              : `Deposit $${total.toFixed(2)}`}
          </Button>
          {!hasOnChainAddress && (
            <p className="text-xs text-muted mt-2 text-center">
              Contract not yet deployed on-chain — deposit will be recorded off-chain and synced later.
            </p>
          )}
        </div>
      )}

      <div className="flex items-start gap-2 mt-4 p-4 rounded-lg bg-brand/10 border border-brand/20">
        <Shield className="h-4 w-4 flex-shrink-0 mt-0.5 text-brand" />
        <p className="text-xs text-brand">
          Funds are locked in a smart contract on Arbitrum. They can only be released when you approve a milestone delivery, or refunded if a Kleros dispute rules in your favor.
        </p>
      </div>
    </div>
  );
}
