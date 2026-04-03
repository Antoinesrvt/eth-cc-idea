"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import {
  Card,
  CardContent,
  Chip,
  Spinner,
  Tooltip,
  Button,
  Input,
} from "@heroui/react";
import {
  CheckCircle2,
  ShieldCheck,
  UserCircle,
  Pencil,
  Upload,
  FileCheck,
  FileClock,
} from "lucide-react";
import { useProfile } from "@/hooks/use-profile";
import { useApi } from "@/hooks/use-api";
import {
  PageHeader,
  SectionCard,
  LabeledProgress,
  StatusBadge,
  EmptyState,
  FormField,
  AgencySetupSection,
} from "@/components/ui";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface TierInfo {
  name: string;
  icon: string;
  color: "warning" | "accent" | "success" | "default";
  nextHint: string;
}

interface Achievement {
  id: string;
  name: string;
  icon: string;
  earned: boolean;
  progress: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DOCUMENT_LABELS = [
  "Business Registration",
  "KYC Verification",
  "Insurance Certificate",
  "Portfolio Proof",
  "Other",
];

/* ------------------------------------------------------------------ */
/*  Tier system                                                        */
/* ------------------------------------------------------------------ */

function getTier(score: number): TierInfo {
  if (score >= 96)
    return {
      name: "Elite",
      icon: "\ud83d\udc51",
      color: "warning",
      nextHint: `${score - 95} points above Elite threshold`,
    };
  if (score >= 81)
    return {
      name: "Diamond",
      icon: "\ud83d\udc8e",
      color: "accent",
      nextHint: `${96 - score} pts to Elite`,
    };
  if (score >= 61)
    return {
      name: "Established",
      icon: "\ud83c\udf33",
      color: "success",
      nextHint: `${81 - score} pts to Diamond`,
    };
  if (score >= 31)
    return {
      name: "Growing",
      icon: "\ud83c\udf3f",
      color: "success",
      nextHint: `${61 - score} pts to Established`,
    };
  return {
    name: "Seedling",
    icon: "\ud83c\udf31",
    color: "default",
    nextHint: `${31 - score} pts to Growing`,
  };
}

/* ------------------------------------------------------------------ */
/*  Achievement definitions                                            */
/* ------------------------------------------------------------------ */

function getAchievements(
  completed: number,
  disputesLost: number,
  volume: number,
  streak: number,
): Achievement[] {
  return [
    {
      id: "first",
      name: "First Contract",
      icon: "\ud83c\udfaf",
      earned: completed >= 1,
      progress: `${Math.min(completed, 1)}/1 contracts`,
    },
    {
      id: "clean",
      name: "Clean Record",
      icon: "\u26a1",
      earned: disputesLost === 0 && completed >= 3,
      progress: disputesLost === 0 ? "\u2713" : "Has disputes",
    },
    {
      id: "10x",
      name: "10x Completed",
      icon: "\ud83c\udfc6",
      earned: completed >= 10,
      progress: `${Math.min(completed, 10)}/10 contracts`,
    },
    {
      id: "volume",
      name: "$100K Volume",
      icon: "\ud83d\udcb0",
      earned: volume >= 100000,
      progress: `$${(volume / 1000).toFixed(0)}K/$100K`,
    },
    {
      id: "streak",
      name: "Hot Streak",
      icon: "\ud83d\udd25",
      earned: streak >= 5,
      progress: `${Math.min(streak, 5)}/5 streak`,
    },
  ];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCurrency(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/* ------------------------------------------------------------------ */
/*  Score Ring (SVG)                                                    */
/* ------------------------------------------------------------------ */

function ScoreRing({ score, size = 120, initials = "?" }: { score: number; size?: number; initials?: string }) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
        aria-label={`Score: ${score} out of 100`}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-border"
        />
        {/* Score arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#scoreGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 1s ease-out",
          }}
        />
        <defs>
          <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--accent))" />
            <stop offset="100%" stopColor="hsl(var(--success))" />
          </linearGradient>
        </defs>
      </svg>
      {/* Avatar fallback in center */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-[calc(100%-20px)] h-[calc(100%-20px)] rounded-full bg-surface-secondary flex items-center justify-center">
          <span className="text-2xl font-bold text-foreground">{initials}</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Achievement Badge                                                  */
/* ------------------------------------------------------------------ */

function AchievementBadge({ achievement }: { achievement: Achievement }) {
  return (
    <Tooltip>
      <Tooltip.Trigger>
        <div
          className={`flex flex-col items-center gap-1.5 min-w-[100px] p-4 rounded-xl border transition-all cursor-default ${
            achievement.earned
              ? "border-accent/40 bg-accent/5 shadow-sm"
              : "border-dashed border-border bg-surface opacity-40"
          }`}
        >
          <span className="text-2xl">{achievement.icon}</span>
          <span className="text-[11px] font-semibold text-foreground leading-tight text-center">
            {achievement.name}
          </span>
          {achievement.earned ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
          ) : (
            <span className="text-[10px] text-muted font-mono">
              {achievement.progress}
            </span>
          )}
        </div>
      </Tooltip.Trigger>
      <Tooltip.Content className="bg-surface border border-border text-foreground px-3 py-2 text-xs rounded-lg shadow-lg">
        <Tooltip.Arrow />
        {achievement.earned
          ? `Earned: ${achievement.name}`
          : `Progress: ${achievement.progress}`}
      </Tooltip.Content>
    </Tooltip>
  );
}

/* ------------------------------------------------------------------ */
/*  Edit Profile Form                                                  */
/* ------------------------------------------------------------------ */

function EditProfileForm({
  initialName,
  initialEmail,
  onSave,
  onCancel,
}: {
  initialName: string;
  initialEmail: string;
  onSave: (data: { name: string; email: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({ name, email });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="Name">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="max-w-sm"
        />
      </FormField>
      <FormField label="Email">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="max-w-sm"
        />
      </FormField>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" isDisabled={saving} size="sm">
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onPress={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Document Upload Section                                            */
/* ------------------------------------------------------------------ */

function DocumentUploadSection({
  attestations,
  onUpload,
}: {
  attestations: { label: string; verified: boolean; hash?: string }[];
  onUpload: (file: File, label: string) => Promise<void>;
}) {
  const [selectedLabel, setSelectedLabel] = useState(DOCUMENT_LABELS[0]);
  const [uploading, setUploading] = useState(false);
  const [lastHash, setLastHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setLastHash(null);
    try {
      await onUpload(file, selectedLabel);
      // After upload, show the hash
      setLastHash("Uploaded successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      {/* Existing attestations */}
      {attestations.length > 0 && (
        <div className="space-y-2">
          {attestations.map((att, idx) => (
            <div
              key={`${att.label}-${idx}`}
              className="flex items-center gap-3 p-3 rounded-lg border border-border bg-surface-secondary"
            >
              {att.verified ? (
                <FileCheck className="h-4 w-4 text-success shrink-0" />
              ) : (
                <FileClock className="h-4 w-4 text-warning shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {att.label}
                </p>
                {att.hash && (
                  <p className="text-xs text-muted font-mono truncate">
                    SHA-256: {att.hash}
                  </p>
                )}
              </div>
              <Chip
                size="sm"
                color={att.verified ? "success" : "warning"}
                variant="soft"
              >
                {att.verified ? "Verified" : "Pending"}
              </Chip>
            </div>
          ))}
        </div>
      )}

      {/* Upload form */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
        <FormField label="Document Type">
          <select
            value={selectedLabel}
            onChange={(e) => setSelectedLabel(e.target.value)}
            className="h-10 px-3 rounded-md border border-border bg-surface text-foreground text-sm w-full max-w-[220px]"
          >
            {DOCUMENT_LABELS.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        </FormField>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/*"
            onChange={handleUpload}
            className="hidden"
            id="doc-upload"
          />
          <Button
            size="sm"
            variant="outline"
            isDisabled={uploading}
            onPress={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            Upload Document
          </Button>
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {lastHash && !error && (
        <p className="text-sm text-success">{lastHash}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function ProfilePage() {
  const {
    profile,
    team,
    loading: profileLoading,
    refresh: refreshProfile,
    updateProfile,
    updateAgencyProfile,
    inviteTeamMember,
    uploadDocument,
    walletAddress,
  } = useProfile();

  // Fetch contracts for stats
  const contractsUrl = walletAddress
    ? `/api/contracts?user=${encodeURIComponent(walletAddress)}`
    : null;
  const { data: rawContracts, loading } = useApi<Array<{ id: string; title: string; status: string; totalValue: number; createdAt: string }>>(contractsUrl);
  const apiContracts = rawContracts ?? [];

  const [editing, setEditing] = useState(false);

  // Wallet balance — query chain RPC
  const [balance, setBalance] = useState<string | null>(null);

  useEffect(() => {
    if (!walletAddress) return;
    let cancelled = false;
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc";
    fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getBalance",
        params: [walletAddress, "latest"],
        id: 1,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.result) {
          setBalance((parseInt(data.result, 16) / 1e18).toString());
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [walletAddress]);

  /* ---- Derive stats from real data ---- */
  const completed = useMemo(
    () => apiContracts.filter((c) => c.status === "completed").length,
    [apiContracts],
  );
  const failed = useMemo(
    () => apiContracts.filter((c) => c.status === "failed").length,
    [apiContracts],
  );
  const disputesWon = 0;
  const disputesLost = 0;
  const totalVolume = useMemo(
    () => apiContracts.reduce((sum, c) => sum + c.totalValue, 0),
    [apiContracts],
  );
  const streak = completed; // simplified streak = completed count
  const reputationScore = useMemo(() => {
    if (apiContracts.length === 0) return 0;
    const completionRate =
      completed + failed > 0 ? (completed / (completed + failed)) * 100 : 0;
    return Math.round(completionRate);
  }, [apiContracts, completed, failed]);
  const onTimeDelivery = useMemo(() => {
    if (apiContracts.length === 0) return 0;
    return Math.round(
      (apiContracts.filter((c) => c.status === "completed").length /
        Math.max(apiContracts.length, 1)) *
        100,
    );
  }, [apiContracts]);

  const tier = getTier(reputationScore);
  const achievements = getAchievements(
    completed,
    disputesLost,
    totalVolume,
    streak,
  );

  /* ---- Score breakdown ---- */
  const completionRate =
    completed + failed > 0
      ? Math.round((completed / (completed + failed)) * 100)
      : 0;
  const disputeWinRate =
    disputesWon + disputesLost > 0
      ? Math.round((disputesWon / (disputesWon + disputesLost)) * 100)
      : 0;

  /* ---- Contract history ---- */
  const contractHistory = useMemo(() => {
    return apiContracts.map((c) => ({
      id: c.id,
      title: c.title,
      role: "agency" as const,
      value: c.totalValue,
      status: c.status,
      date: new Date(c.createdAt).toLocaleDateString("en-CA"),
    }));
  }, [apiContracts]);

  /* ---- Profile display values ---- */
  const profileName = profile?.name || "Your Profile";
  const profileInitials = profile?.name
    ? profile.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";
  const attestations = profile?.agencyProfile?.attestations ?? [];

  if (loading || profileLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <PageHeader
          title="Profile"
          description="Your reputation, achievements, and history"
          backHref="/dashboard"
          backLabel="Dashboard"
        />
        <div className="flex justify-center py-24">
          <Spinner size="lg" className="text-accent" />
        </div>
      </div>
    );
  }

  // No contracts at all — show empty profile state
  if (apiContracts.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <PageHeader
          title="Profile"
          description="Your reputation, achievements, and history"
          backHref="/dashboard"
          backLabel="Dashboard"
        />
        <EmptyState
          icon={<UserCircle className="h-12 w-12" />}
          title="Your profile is empty"
          description="Complete your first contract to build your reputation."
          action={
            <a
              href="/contracts/new"
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-accent text-accent-foreground font-medium shadow-sm active:scale-[0.98] transition-all"
            >
              Create Your First Contract
            </a>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <PageHeader
        title="Profile"
        description="Your reputation, achievements, and history"
        backHref="/dashboard"
        backLabel="Dashboard"
      />

      {/* ---------------------------------------------------------------- */}
      {/*  Header Section: Avatar with score ring                          */}
      {/* ---------------------------------------------------------------- */}
      <Card className="border border-border mb-8">
        <CardContent className="p-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Score Ring + Avatar */}
            <ScoreRing score={reputationScore} size={120} initials={profileInitials} />

            {/* Identity Info */}
            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-3 flex-wrap">
                <h2 className="text-2xl font-bold text-foreground tracking-tight">
                  {profileName}
                </h2>
                <Chip
                  size="sm"
                  color={tier.color}
                  variant="soft"
                  className="font-bold text-xs gap-1"
                >
                  <span>{tier.icon}</span> {tier.name}
                </Chip>
              </div>

              {profile?.email && (
                <p className="text-sm text-muted mt-1">{profile.email}</p>
              )}

              {walletAddress && (
                <div className="flex items-center justify-center sm:justify-start gap-3 mt-1">
                  <p className="text-xs text-muted font-mono">
                    {truncateAddress(walletAddress)}
                  </p>
                  {balance !== null && (
                    <Chip size="sm" variant="soft" color="success" className="text-xs font-mono">
                      {parseFloat(balance).toLocaleString(undefined, { maximumFractionDigits: 4 })} ETH
                    </Chip>
                  )}
                </div>
              )}

              <div className="flex items-center justify-center sm:justify-start gap-4 mt-3">
                <span className="text-sm font-semibold text-foreground">
                  Score: {reputationScore}/100
                </span>
              </div>

              <p className="text-xs text-muted mt-1.5">{tier.nextHint}</p>

              {streak > 0 && (
                <div className="flex items-center justify-center sm:justify-start gap-1.5 mt-2 text-warning">
                  <span className="text-sm">{"\ud83d\udd25"}</span>
                  <span className="text-xs font-semibold">
                    {streak} contract streak
                  </span>
                </div>
              )}

              {/* Edit Profile Button */}
              {!editing && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onPress={() => setEditing(true)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit Profile
                </Button>
              )}
            </div>
          </div>

          {/* Inline Edit Form */}
          {editing && (
            <div className="mt-6 pt-6 border-t border-border">
              <EditProfileForm
                initialName={profile?.name ?? ""}
                initialEmail={profile?.email ?? ""}
                onSave={async (data) => {
                  await updateProfile(data);
                  setEditing(false);
                }}
                onCancel={() => setEditing(false)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---------------------------------------------------------------- */}
      {/*  Agency Profile Setup                                            */}
      {/* ---------------------------------------------------------------- */}
      {profile?.roles?.includes("agency") && (
        <AgencySetupSection
          agencyProfile={profile?.agencyProfile}
          team={team}
          onSaveProfile={async (data) => {
            await updateAgencyProfile(data);
          }}
          onInviteMember={async (email, name, role) => {
            await inviteTeamMember({ email, name, role });
          }}
          onRefresh={refreshProfile}
        />
      )}

      {/* ---------------------------------------------------------------- */}
      {/*  Contracts (most important — shown first)                        */}
      {/* ---------------------------------------------------------------- */}
      <SectionCard title="Contract History" className="mb-6">
        {contractHistory.length > 0 ? (
          <div className="overflow-x-auto -mx-6 -mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">
                    Title
                  </th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-muted uppercase tracking-wider">
                    Role
                  </th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-muted uppercase tracking-wider">
                    Value
                  </th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-muted uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {contractHistory.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-surface-secondary transition-colors"
                  >
                    <td className="px-6 py-3 font-medium text-foreground">
                      {c.title}
                    </td>
                    <td className="px-3 py-3">
                      <Chip size="sm" variant="soft" color="default">
                        as {c.role}
                      </Chip>
                    </td>
                    <td className="px-3 py-3 text-right text-foreground font-mono">
                      {formatCurrency(c.value)}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <StatusBadge
                        status={
                          c.status as
                            | "active"
                            | "completed"
                            | "draft"
                            | "disputed"
                            | "failed"
                        }
                      />
                    </td>
                    <td className="px-6 py-3 text-right text-muted text-xs">
                      {c.date}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted text-center py-8">No contract history yet.</p>
        )}
      </SectionCard>

      {/* ---------------------------------------------------------------- */}
      {/*  Score Breakdown                                                 */}
      {/* ---------------------------------------------------------------- */}
      <SectionCard title="Score Breakdown" className="mb-6">
        <div className="space-y-5">
          <LabeledProgress
            label="Completion Rate"
            value={completionRate}
            color={completionRate >= 80 ? "success" : "warning"}
          />
          <LabeledProgress
            label="Dispute Win Rate"
            value={disputeWinRate}
            color={disputeWinRate >= 80 ? "success" : "warning"}
          />
          <LabeledProgress
            label="On-Time Delivery"
            value={onTimeDelivery}
            color={onTimeDelivery >= 80 ? "success" : "warning"}
          />
        </div>
      </SectionCard>

      {/* ---------------------------------------------------------------- */}
      {/*  Achievements                                                    */}
      {/* ---------------------------------------------------------------- */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
          Achievements
        </h3>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {achievements.map((a) => (
            <AchievementBadge key={a.id} achievement={a} />
          ))}
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/*  Legal Documents / Attestations                                  */}
      {/* ---------------------------------------------------------------- */}
      <SectionCard
        title="Legal Documents"
        icon={<ShieldCheck className="h-4 w-4 text-accent" />}
        className="mb-8"
      >
        <DocumentUploadSection
          attestations={attestations}
          onUpload={async (file, label) => {
            await uploadDocument(file, label);
          }}
        />
      </SectionCard>
    </div>
  );
}
