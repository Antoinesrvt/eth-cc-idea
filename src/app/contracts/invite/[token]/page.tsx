"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle, FileText, Loader2, DollarSign, Calendar, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { Button, Card, CardContent } from "@heroui/react";
import { PageHeader, SectionCard, StatusBadge } from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";

interface InviteMilestone {
  name: string;
  description?: string;
  amount: number;
  deadline: string | Date;
}

interface InviteSummary {
  id: string;
  title: string;
  description: string;
  category: string;
  totalValue: number;
  inviteRole: "client" | "agency";
  creatorRole: "agency" | "client";
  status: string;
  milestones: InviteMilestone[];
}

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { authenticated, login, walletAddress, getAuthToken, ready } = useAuth();

  const [invite, setInvite] = useState<InviteSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [showMilestones, setShowMilestones] = useState(false);

  // Fetch invite summary
  useEffect(() => {
    if (!token) return;
    fetch(`/api/contracts/invite/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Invite not found");
        }
        return res.json();
      })
      .then(setInvite)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    if (!authenticated) {
      login();
      return;
    }

    setAccepting(true);
    setError(null);
    try {
      const authToken = await getAuthToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
      if (walletAddress) headers["X-Wallet-Address"] = walletAddress;

      const res = await fetch(`/api/contracts/invite/${token}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          walletAddress: walletAddress || undefined,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to accept");

      setAccepted(true);
      setTimeout(() => router.push(result.redirectTo), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept invite");
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-accent" />
        <p className="mt-4 text-muted">Loading invitation...</p>
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <PageHeader title="Invitation Not Found" description={error} backHref="/" backLabel="Go Home" />
      </div>
    );
  }

  if (!invite) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <PageHeader
        title="You've been invited"
        description={`Join as the ${invite.inviteRole} on this contract`}
      />

      {/* Contract overview */}
      <Card className="border border-border mb-6">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">{invite.title}</h2>
              <div className="mt-1"><StatusBadge status={invite.category} /></div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-accent">${invite.totalValue.toLocaleString()}</div>
              <div className="text-xs text-muted">Total value</div>
            </div>
          </div>

          <p className="text-sm text-muted mb-4">{invite.description}</p>

          <div className="flex items-center gap-2 text-sm text-muted">
            <FileText className="h-4 w-4" />
            <span>Created by the {invite.creatorRole === "agency" ? "agency" : "client"}</span>
          </div>
        </CardContent>
      </Card>

      {/* Milestones */}
      <Card className="border border-border mb-6">
        <CardContent className="p-0">
          <button
            onClick={() => setShowMilestones(!showMilestones)}
            className="w-full flex items-center justify-between p-4 hover:bg-surface-secondary/50 transition-colors"
          >
            <span className="font-medium text-sm">
              {invite.milestones.length} Milestone{invite.milestones.length !== 1 ? "s" : ""}
            </span>
            {showMilestones ? <ChevronUp className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}
          </button>

          {showMilestones && (
            <div className="border-t border-border">
              {invite.milestones.map((m, i) => (
                <div key={i} className={`p-4 ${i > 0 ? "border-t border-border/50" : ""}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{m.name}</span>
                    <span className="text-sm font-bold">${m.amount.toLocaleString()}</span>
                  </div>
                  {m.description && (
                    <p className="text-xs text-muted mb-2">{m.description}</p>
                  )}
                  <div className="flex items-center gap-1 text-xs text-muted">
                    <Calendar className="h-3 w-3" />
                    <span>Due: {new Date(m.deadline).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Your role */}
      <Card className="border border-accent/30 bg-accent/5 mb-6">
        <CardContent className="p-4">
          <p className="text-sm">
            You are joining as the <strong className="text-accent">{invite.inviteRole}</strong>.
            {invite.inviteRole === "client" && (
              <span className="text-muted"> After accepting, you'll need to deposit the escrow (${invite.totalValue.toLocaleString()}) to activate the contract.</span>
            )}
            {invite.inviteRole === "agency" && (
              <span className="text-muted"> After accepting, the client will deposit escrow. Then you can start delivering milestones.</span>
            )}
          </p>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 rounded-lg bg-danger/10 border border-danger/20 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-danger mt-0.5 shrink-0" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {/* Accept button */}
      {accepted ? (
        <div className="flex items-center justify-center gap-3 py-8">
          <CheckCircle className="h-6 w-6 text-success" />
          <span className="text-lg font-medium text-success">Accepted! Redirecting...</span>
        </div>
      ) : (
        <div className="space-y-3">
          <Button
            onPress={handleAccept}
            isDisabled={accepting || !ready}
            fullWidth
            className="py-4 rounded-xl bg-accent text-accent-foreground font-semibold text-base"
          >
            {accepting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Accepting...</>
            ) : !authenticated ? (
              "Sign in to Accept"
            ) : (
              "Accept & Join Contract"
            )}
          </Button>
          {authenticated && walletAddress && (
            <p className="text-xs text-center text-muted">
              Connected as {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </p>
          )}
          {authenticated && !walletAddress && (
            <p className="text-xs text-center text-warning">
              Wallet is being created... Click accept to proceed.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
