"use client";

import { useState } from "react";
import { Card, CardContent, Button, Input, Chip } from "@heroui/react";
import { Building2, AlertTriangle, Globe, Plus, X } from "lucide-react";
import { FormField } from "./form-field";
import type { AgencyProfile, TeamMember } from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

const CATEGORIES = [
  "development",
  "design",
  "marketing",
  "legal",
  "consulting",
  "market_making",
  "security_audit",
  "advisory",
  "exchange_listing",
  "defi",
  "infrastructure",
  "analytics",
  "tokenomics",
  "pr",
  "recruiting",
  "community",
  "other",
];

function formatCategory(cat: string): string {
  return cat
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function truncateAddress(addr: string): string {
  if (!addr || addr.startsWith("invite:")) return addr.replace("invite:", "");
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/* ------------------------------------------------------------------ */
/*  Edit Form                                                           */
/* ------------------------------------------------------------------ */

interface AgencyFormData {
  companyName: string;
  description: string;
  website: string;
  categories: string[];
}

function AgencyEditForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: AgencyFormData;
  onSave: (data: AgencyFormData) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<AgencyFormData>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleCategory = (cat: string) => {
    setForm((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName.trim()) {
      setError("Company name is required");
      return;
    }
    if (form.categories.length === 0) {
      setError("Select at least one category");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <FormField label="Company Name *">
        <Input
          value={form.companyName}
          onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
          placeholder="e.g. NovaDev Studio"
          className="max-w-sm"
        />
      </FormField>

      <FormField label="Description">
        <textarea
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          placeholder="What does your agency do?"
          rows={3}
          className="w-full max-w-lg px-3 py-2 rounded-md border border-border bg-surface text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
      </FormField>

      <FormField label="Website">
        <Input
          type="url"
          value={form.website}
          onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
          placeholder="https://yoursite.com"
          className="max-w-sm"
        />
      </FormField>

      <FormField label="Categories *">
        <div className="flex flex-wrap gap-2 mt-1">
          {CATEGORIES.map((cat) => {
            const selected = form.categories.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => toggleCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  selected
                    ? "bg-accent text-accent-foreground border-accent"
                    : "bg-surface border-border text-muted hover:border-accent/60 hover:text-foreground"
                }`}
              >
                {formatCategory(cat)}
              </button>
            );
          })}
        </div>
      </FormField>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-2 pt-1">
        <Button type="submit" variant="primary" isDisabled={saving} size="sm">
          {saving ? "Saving..." : "Save Agency Profile"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onPress={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Invite Form                                                          */
/* ------------------------------------------------------------------ */

function InviteForm({
  onInvite,
  onCancel,
}: {
  onInvite: (email: string, name: string, role: "admin" | "member") => Promise<void>;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await onInvite(email.trim(), name.trim(), role);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 p-3 rounded-lg border border-border bg-surface-secondary space-y-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="team@example.com"
          className="flex-1"
        />
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (optional)"
          className="flex-1"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "admin" | "member")}
          className="h-10 px-3 rounded-md border border-border bg-surface text-foreground text-sm"
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" isDisabled={sending}>
          {sending ? "Sending..." : "Send Invite"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onPress={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Main AgencySetupSection                                             */
/* ------------------------------------------------------------------ */

interface AgencySetupSectionProps {
  agencyProfile?: AgencyProfile;
  team: TeamMember[];
  onSaveProfile: (data: AgencyFormData) => Promise<void>;
  onInviteMember: (email: string, name: string, role: "admin" | "member") => Promise<void>;
  onRefresh: () => void;
}

export function AgencySetupSection({
  agencyProfile,
  team,
  onSaveProfile,
  onInviteMember,
  onRefresh,
}: AgencySetupSectionProps) {
  const [editing, setEditing] = useState(false);
  const [inviting, setInviting] = useState(false);

  const hasProfile = !!agencyProfile;
  const isComplete = !!(agencyProfile?.companyName && agencyProfile?.description);
  const isBasic = hasProfile && !isComplete;

  const handleSave = async (data: AgencyFormData) => {
    await onSaveProfile(data);
    setEditing(false);
    onRefresh();
  };

  const handleInvite = async (email: string, name: string, role: "admin" | "member") => {
    await onInviteMember(email, name, role);
    setInviting(false);
    onRefresh();
  };

  const editInitial: AgencyFormData = {
    companyName: agencyProfile?.companyName ?? "",
    description: agencyProfile?.description ?? "",
    website: agencyProfile?.website ?? "",
    categories: agencyProfile?.categories ?? [],
  };

  /* -- State A: No agency profile yet -- */
  if (!hasProfile) {
    return (
      <Card className="border border-border mb-6">
        <CardContent className="p-5">
          {editing ? (
            <>
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="h-4 w-4 text-accent" />
                <span className="text-sm font-semibold text-foreground">Set up your agency profile</span>
              </div>
              <AgencyEditForm
                initial={{ companyName: "", description: "", website: "", categories: [] }}
                onSave={handleSave}
                onCancel={() => setEditing(false)}
              />
            </>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-start gap-3 flex-1">
                <Building2 className="h-5 w-5 text-accent mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Set up your agency profile</p>
                  <p className="text-xs text-muted mt-0.5">
                    Complete your agency profile to appear on the marketplace and build trust with clients.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onPress={() => setEditing(true)}
                className="shrink-0"
              >
                Set Up Agency
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  /* -- State B: Basic profile (auto-created, incomplete) -- */
  if (isBasic) {
    return (
      <Card className="border border-border mb-6">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="h-4 w-4 text-accent" />
            <span className="text-sm font-semibold text-foreground">
              Agency: {agencyProfile.companyName}
            </span>
          </div>
          {agencyProfile.categories && agencyProfile.categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {agencyProfile.categories.map((cat) => (
                <Chip key={cat} size="sm" variant="soft" color="default">
                  {formatCategory(cat)}
                </Chip>
              ))}
            </div>
          )}
          {!editing ? (
            <>
              <div className="flex items-center gap-2 text-warning text-xs mb-3">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Complete your profile for better visibility</span>
              </div>
              <Button size="sm" variant="outline" onPress={() => setEditing(true)}>
                Edit Agency Profile
              </Button>
            </>
          ) : (
            <AgencyEditForm initial={editInitial} onSave={handleSave} onCancel={() => setEditing(false)} />
          )}
        </CardContent>
      </Card>
    );
  }

  /* -- State C: Complete profile -- */
  return (
    <Card className="border border-border mb-6">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="h-4 w-4 text-accent" />
          <span className="text-base font-semibold text-foreground">{agencyProfile.companyName}</span>
        </div>

        {agencyProfile.description && (
          <p className="text-sm text-muted mb-2">{agencyProfile.description}</p>
        )}

        {agencyProfile.website && (
          <a
            href={agencyProfile.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline mb-3"
          >
            <Globe className="h-3 w-3" />
            {agencyProfile.website.replace(/^https?:\/\//, "")}
          </a>
        )}

        {agencyProfile.categories && agencyProfile.categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {agencyProfile.categories.map((cat) => (
              <Chip key={cat} size="sm" variant="soft" color="default">
                {formatCategory(cat)}
              </Chip>
            ))}
          </div>
        )}

        {/* Team section */}
        <div className="border-t border-border pt-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">
              Team ({team.length} {team.length === 1 ? "member" : "members"})
            </h4>
            {!inviting && (
              <Button
                size="sm"
                variant="ghost"
                onPress={() => setInviting(true)}
                className="text-xs h-7"
              >
                <Plus className="h-3 w-3" />
                Invite
              </Button>
            )}
          </div>

          {team.length > 0 && (
            <div className="space-y-1.5 mb-2">
              {team.map((member) => (
                <div
                  key={member.memberAddress}
                  className="flex items-center gap-2 text-sm"
                >
                  <span className="text-muted">👤</span>
                  <span className="font-mono text-xs text-foreground flex-1">
                    {member.memberEmail
                      ? member.memberEmail
                      : truncateAddress(member.memberAddress)}
                    {member.memberName && (
                      <span className="text-muted ml-1">({member.memberName})</span>
                    )}
                  </span>
                  <Chip size="sm" variant="soft" color={member.role === "owner" ? "accent" : "default"}>
                    {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                  </Chip>
                </div>
              ))}
            </div>
          )}

          {inviting && (
            <InviteForm
              onInvite={handleInvite}
              onCancel={() => setInviting(false)}
            />
          )}
        </div>

        {/* Edit form or edit button */}
        {editing ? (
          <AgencyEditForm initial={editInitial} onSave={handleSave} onCancel={() => setEditing(false)} />
        ) : (
          <Button size="sm" variant="outline" onPress={() => setEditing(true)}>
            Edit Agency Profile
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
