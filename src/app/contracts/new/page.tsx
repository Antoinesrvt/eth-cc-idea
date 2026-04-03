"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  CheckCircle,
  Clock,
  ShieldCheck,
  FileText,
  ArrowRight,
  ArrowLeft,
  Loader2,
  DollarSign,
  PenTool,
  Upload,
  X,
  Plus,
  ChevronDown,
  ChevronUp,
  Wallet,
  BarChart3,
  Rocket,
  Trash2,
  Brain,
  Eye,
  Mail,
  Copy,
  Check,
  Link2,
} from "lucide-react";
import { useContracts } from "@/hooks/use-contracts";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, Button, Input, TextArea, Chip } from "@heroui/react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { PageHeader, SectionCard, FormField, LabeledProgress } from "@/components/ui";
import type { CreateContractInput } from "@/lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

type CreationStep =
  | "choose"
  | "ai-review"
  | "manual-details"
  | "manual-milestones"
  | "fees"
  | "review";

type CreationMode = "ai" | "manual" | null;

const CATEGORIES = [
  "development", "design", "marketing", "legal", "consulting",
  "market_making", "security_audit", "advisory", "exchange_listing",
  "defi", "infrastructure", "analytics", "tokenomics", "pr",
  "recruiting", "community", "other",
] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_LABELS: Record<Category, string> = {
  development: "Development",
  design: "Design",
  marketing: "Marketing",
  legal: "Legal",
  consulting: "Consulting",
  market_making: "Market Making",
  security_audit: "Security Audit",
  advisory: "Advisory",
  exchange_listing: "Exchange Listing",
  defi: "DeFi",
  infrastructure: "Infrastructure",
  analytics: "Analytics",
  tokenomics: "Tokenomics",
  pr: "PR & Comms",
  recruiting: "Recruiting",
  community: "Community",
  other: "Other",
};

const CATEGORY_ICONS: Partial<Record<Category, string>> = {
  development: "Code",
  design: "Palette",
  marketing: "Megaphone",
  legal: "Scale",
  consulting: "Lightbulb",
  market_making: "LineChart",
  security_audit: "Shield",
  advisory: "Compass",
  exchange_listing: "ArrowUpDown",
  defi: "Landmark",
  infrastructure: "Server",
  analytics: "BarChart",
  tokenomics: "Coins",
  pr: "Newspaper",
  recruiting: "Users",
  community: "MessageCircle",
  other: "MoreHorizontal",
};

const AI_STEPS = ["Upload", "Review", "Fees", "Deploy"] as const;
const MANUAL_STEPS = ["Details", "Milestones", "Fees", "Deploy"] as const;

type LocalMilestone = {
  id: string;
  name: string;
  amount: number;
  description: string;
  deadline: string;
  aiDetected?: boolean;
};

const PROCESSING_MESSAGES = [
  "Reading document...",
  "Extracting milestones...",
  "Analyzing amounts...",
  "Generating contract...",
];

import { PLATFORM_FEE_PERCENT } from "@/lib/types";

const slide = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0, transition: { type: "spring" as const, stiffness: 260, damping: 26 } },
  exit: { opacity: 0, x: -24, transition: { duration: 0.15 } },
};

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function NewContractPage() {
  const router = useRouter();
  const { refresh } = useContracts();
  // Submit is handled inline via fetch to support the counterparty field
  const { authenticated, walletAddress, login, ready, getAuthToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Navigation state
  const [step, setStep] = useState<CreationStep>("choose");
  const [mode, setMode] = useState<CreationMode>(null);

  // AI processing state
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiProcessingStep, setAiProcessingStep] = useState(0);
  const [aiConfidence, setAiConfidence] = useState(0);
  const [aiError, setAiError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Contract fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const creatorRole = "agency" as const;
  const [categories, setCategories] = useState<Category[]>([]);
  const [customCategory, setCustomCategory] = useState("");
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [milestones, setMilestones] = useState<LocalMilestone[]>([]);
  const [expandedMilestone, setExpandedMilestone] = useState<string | null>(null);

  // Fees
  const [bdEnabled, setBdEnabled] = useState(false);
  const [bdWallet, setBdWallet] = useState("");
  const [bdPercent, setBdPercent] = useState(5);

  // Submit
  const [creating, setCreating] = useState(false);
  const [createdResult, setCreatedResult] = useState<{ inviteUrl?: string; inviteEmail?: string; contractId?: string } | null>(null);
  const [createdContract, setCreatedContract] = useState<{ id: string; title: string; totalValue: number; inviteUrl?: string; inviteEmail?: string } | null>(null);

  // Raw terms text from AI extraction
  const [rawTermsText, setRawTermsText] = useState<string | null>(null);

  // Load demo template for quick testing
  const loadTemplate = () => {
    setTitle("DeFi Dashboard Development");
    setDescription("Full-stack development of a DeFi analytics dashboard with wallet integration, portfolio tracking, and yield optimization.");
    setCounterparty("client@example.com");
    setCategories(["development"]);
    setMilestones([
      { id: crypto.randomUUID(), name: "UI/UX Design & Architecture", description: "Figma designs, component library, system architecture doc.", amount: 8000, deadline: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0] },
      { id: crypto.randomUUID(), name: "Core Dashboard & Wallet Integration", description: "Dashboard views, wallet providers, portfolio data.", amount: 18000, deadline: new Date(Date.now() + 60 * 86400000).toISOString().split("T")[0] },
      { id: crypto.randomUUID(), name: "Yield Optimizer & Launch", description: "Yield comparison engine, notifications, CI/CD.", amount: 14000, deadline: new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0] },
    ]);
    setMode("manual");
    setStep("manual-details");
  };

  // Field tracking for AI
  const [aiFields, setAiFields] = useState<Set<string>>(new Set());

  const totalAmount = milestones.reduce((s, m) => s + m.amount, 0);

  // ─── Milestone helpers ────────────────────────────────────────────────

  const setMilestone = (id: string, patch: Partial<LocalMilestone>) =>
    setMilestones((ms) => ms.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const removeMilestone = (id: string) =>
    setMilestones((ms) => ms.filter((m) => m.id !== id));

  const addMilestone = () => {
    const newId = crypto.randomUUID();
    setMilestones((ms) => [
      ...ms,
      { id: newId, name: "", amount: 0, description: "", deadline: "" },
    ]);
    setExpandedMilestone(newId);
  };

  // ─── Category toggle ─────────────────────────────────────────────────

  const toggleCategory = (cat: Category) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  // ─── AI document processing ──────────────────────────────────────────

  const handleAiGenerate = useCallback(async (file: File) => {
    setAiProcessing(true);
    setAiProcessingStep(0);
    setAiError(null);
    setUploadedFileName(file.name);

    // Animate through processing steps
    const interval = setInterval(() => {
      setAiProcessingStep((prev) => {
        if (prev < PROCESSING_MESSAGES.length - 1) return prev + 1;
        return prev;
      });
    }, 1500);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/ai/generate", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to process document");
      }

      const result: GeneratedContract = await res.json();

      // Populate fields from AI result
      setTitle(result.title);
      setDescription(result.description);
      setCategories([result.category as Category]);
      setMilestones(
        result.milestones.map((m) => ({
          id: crypto.randomUUID(),
          name: m.name,
          amount: m.amount,
          description: m.description,
          deadline: m.deadline,
          aiDetected: true,
        })),
      );
      // Derive confidence from extraction completeness
      let score = 0;
      if (result.title) score += 20;
      if (result.description) score += 20;
      if (result.category) score += 10;
      if (result.milestones?.length > 0) score += 30;
      if (result.milestones?.every((m) => m.amount > 0)) score += 10;
      if (result.milestones?.every((m) => m.deadline)) score += 10;
      setAiConfidence(score);
      if (result.rawText) setRawTermsText(result.rawText);
      setAiFields(new Set(["title", "description", "category", "milestones"]));

      clearInterval(interval);
      setAiProcessing(false);
      setMode("ai");
      setStep("ai-review");
    } catch (err) {
      clearInterval(interval);
      const message = err instanceof Error ? err.message : "Failed to process document";
      setAiError(message);
      toast.error(message);
    }
  }, []);

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) handleAiGenerate(file);
    },
    [handleAiGenerate],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleAiGenerate(file);
        e.target.value = "";
      }
    },
    [handleAiGenerate],
  );

  // ─── Navigation helpers ───────────────────────────────────────────────

  const getStepLabels = () => (mode === "ai" ? AI_STEPS : MANUAL_STEPS);

  const getStepIndex = (): number => {
    if (mode === "ai") {
      switch (step) {
        case "choose": return 0;
        case "ai-review": return 1;
        case "fees": return 2;
        case "review": return 3;
        default: return 0;
      }
    } else {
      switch (step) {
        case "manual-details": return 0;
        case "manual-milestones": return 1;
        case "fees": return 2;
        case "review": return 3;
        default: return 0;
      }
    }
  };

  const goNext = () => {
    if (mode === "ai") {
      switch (step) {
        case "ai-review": setStep("fees"); break;
        case "fees": setStep("review"); break;
      }
    } else {
      switch (step) {
        case "manual-details": setStep("manual-milestones"); break;
        case "manual-milestones": setStep("fees"); break;
        case "fees": setStep("review"); break;
      }
    }
  };

  const goBack = () => {
    if (step === "ai-review" || step === "manual-details") {
      setStep("choose");
      setMode(null);
      return;
    }
    if (mode === "ai") {
      switch (step) {
        case "fees": setStep("ai-review"); break;
        case "review": setStep("fees"); break;
      }
    } else {
      switch (step) {
        case "manual-milestones": setStep("manual-details"); break;
        case "fees": setStep("manual-milestones"); break;
        case "review": setStep("fees"); break;
      }
    }
  };

  // ─── Submit ───────────────────────────────────────────────────────────

  const isEmailInput = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const counterpartyIsEmail = isEmailInput(counterparty);

  const handleSubmit = async () => {
    if (!authenticated || !walletAddress) {
      login();
      return;
    }

    // ── Client-side validation ──────────────────────────────────
    if (!title?.trim()) {
      toast.error("Contract title is required");
      return;
    }
    if (!counterparty?.trim()) {
      toast.error("Counterparty (wallet address or email) is required");
      return;
    }
    if (milestones.length === 0) {
      toast.error("At least one milestone is required");
      return;
    }
    const invalidMilestone = milestones.find((m) => !m.name?.trim() || !m.amount || m.amount <= 0);
    if (invalidMilestone) {
      toast.error(`Milestone "${invalidMilestone.name || "unnamed"}" needs a name and a positive amount`);
      return;
    }
    const missingDeadline = milestones.find((m) => !m.deadline);
    if (missingDeadline) {
      toast.error(`Milestone "${missingDeadline.name}" needs a deadline`);
      return;
    }

    setCreating(true);
    try {
      const primaryCategory = categories[0] || (customCategory || "other");

      const payload = {
        title: title.trim(),
        description: description?.trim() || `${primaryCategory} contract`,
        category: primaryCategory,
        counterparty: counterparty.trim(),
        bd: bdEnabled && bdWallet ? bdWallet : undefined,
        bdFeePercent: bdEnabled ? bdPercent : undefined,
        termsText: rawTermsText || undefined,
        milestones: milestones.map((m) => ({
          name: m.name.trim(),
          amount: m.amount,
          description: m.description?.trim() || "",
          deadline: new Date(m.deadline),
        })),
      };

      const authToken = await getAuthToken();
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          ...(walletAddress ? { "X-Wallet-Address": walletAddress } : {}),
        },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) {
        const msg = result.details
          ? Object.values(result.details.fieldErrors || {}).flat().join(". ") || result.error
          : result.error;
        throw new Error(msg || "Failed to create contract");
      }

      // Show document reuse note if the same document was already used
      if (result.documentReuseNote) {
        toast.info(result.documentReuseNote, { duration: 6000 });
      }

      // Show blockchain warnings if any on-chain operations failed
      if (result.blockchainWarnings?.length) {
        for (const w of result.blockchainWarnings) {
          toast.warning(`On-chain ${w.operation.replace(/_/g, " ")} failed: ${w.error}`, { duration: 8000 });
        }
      }

      await refresh();

      // Always show success state
      setCreatedContract({
        id: result.id,
        title: title || "Untitled Contract",
        totalValue: totalAmount,
        inviteUrl: result.inviteUrl,
        inviteEmail: counterpartyIsEmail ? counterparty : undefined,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create contract");
      setCreating(false);
    }
  };

  // ─── Fee calculations ─────────────────────────────────────────────────

  const platformFee = totalAmount * (PLATFORM_FEE_PERCENT / 100);
  const bdFee = bdEnabled ? totalAmount * (bdPercent / 100) : 0;
  const netAmount = totalAmount - platformFee - bdFee;

  // ─── Step indicator ───────────────────────────────────────────────────

  const renderStepIndicator = () => {
    if (step === "choose") return null;
    const labels = getStepLabels();
    const currentIdx = getStepIndex();

    return (
      <div className="flex items-center gap-0 mb-8 rounded-xl bg-surface-secondary border border-border p-1">
        {labels.map((s, i) => (
          <div
            key={s}
            className={`flex-1 text-xs font-bold py-2 rounded-lg text-center transition-all ${
              i === currentIdx
                ? "bg-surface text-foreground shadow-sm border border-border"
                : i < currentIdx
                  ? "text-success"
                  : "text-muted"
            }`}
          >
            {i < currentIdx ? (
              <CheckCircle className="h-3 w-3 inline mr-1 mb-0.5" />
            ) : null}
            {s}
          </div>
        ))}
      </div>
    );
  };

  // ─── AI chip component ────────────────────────────────────────────────

  const AiChip = () => (
    <Chip size="sm" variant="soft" color="accent" className="text-[10px] font-bold uppercase tracking-wider">
      <Sparkles className="h-2.5 w-2.5 mr-0.5 inline" />
      AI
    </Chip>
  );

  // ─── Render ───────────────────────────────────────────────────────────

  // ── Success state (full page replacement) ──────────────────────────────────
  if (createdContract) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <motion.div {...fadeIn}>
          <Card className="border border-success/30 bg-success/5 rounded-2xl shadow-sm overflow-hidden">
            <CardContent className="p-8 sm:p-10">
              {/* Icon + heading */}
              <div className="text-center mb-8">
                <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-8 w-8 text-success" />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">Contract created! Send the invite to your client.</h1>
                <p className="text-sm text-muted">
                  <span className="font-semibold text-foreground">{createdContract.title}</span>
                  {createdContract.totalValue > 0 && (
                    <> &mdash; <span className="font-bold text-accent">${createdContract.totalValue.toLocaleString()}</span> total</>
                  )}
                </p>
              </div>

              {/* Email invite confirmation */}
              {createdContract.inviteEmail && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-accent/10 border border-accent/20 mb-4">
                  <Mail className="h-4 w-4 text-accent shrink-0" />
                  <p className="text-sm">
                    Invitation sent to <strong>{createdContract.inviteEmail}</strong>
                  </p>
                </div>
              )}

              {/* Invite link */}
              {createdContract.inviteUrl && (
                <div className="mb-6">
                  <label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">
                    Share this invite link
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2 p-3 rounded-lg bg-surface-secondary border border-border text-sm font-mono truncate">
                      <Link2 className="h-4 w-4 text-muted shrink-0" />
                      <span className="truncate">{createdContract.inviteUrl}</span>
                    </div>
                    <InviteCopyButton url={createdContract.inviteUrl} />
                  </div>
                </div>
              )}

              {/* What's next */}
              <div className="mb-6 p-4 rounded-xl bg-surface border border-border">
                <h3 className="text-sm font-bold text-foreground mb-2 uppercase tracking-wider">
                  What&apos;s Next?
                </h3>
                <p className="text-sm text-muted mb-3">
                  Your client needs to accept the invite and deposit escrow to activate the contract.
                </p>
                <Link
                  href={`/contracts/${createdContract.id}`}
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-surface-secondary border border-border text-sm font-semibold hover:bg-default active:scale-[0.98] transition-all"
                >
                  <Eye className="h-4 w-4" /> View Contract
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <PageHeader
        title="Create a New Contract"
        description="Upload a document for AI-powered extraction or build your contract from scratch."
        backHref="/contracts"
        backLabel="Back to contracts"
      />

      {renderStepIndicator()}

      <AnimatePresence mode="wait">
        {/* ── Step: Choose Creation Method ────────────────────────────────── */}
        {step === "choose" && !aiProcessing && (
          <motion.div key="choose" {...fadeIn}>
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* Upload Document Card */}
              <Card
                className="border-2 border-dashed border-border hover:border-accent/50 transition-all cursor-pointer group"
                onDragOver={(e: React.DragEvent) => e.preventDefault()}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <CardContent className="p-8 text-center flex flex-col items-center justify-center min-h-[280px] relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-5 group-hover:scale-110 transition-transform duration-300">
                      <Sparkles className="h-6 w-6 text-accent" />
                      <Upload className="h-4 w-4 text-accent absolute bottom-3 right-3" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-2">
                      Upload Document
                    </h3>
                    <p className="text-sm text-muted mb-4 max-w-[260px] mx-auto leading-relaxed">
                      Drop a PDF, SOW, proposal, or email thread
                    </p>
                    <p className="text-xs text-muted/60 leading-relaxed max-w-[240px] mx-auto">
                      AI extracts title, milestones, amounts, and terms automatically
                    </p>
                    <div className="mt-5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs font-semibold border-accent/30 text-accent hover:bg-accent/10"
                        onPress={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-3.5 w-3.5 mr-1.5" />
                        Browse Files
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Start from Scratch Card */}
              <Card
                className="border border-border hover:border-foreground/20 transition-all cursor-pointer group"
                onClick={() => {
                  setMode("manual");
                  setStep("manual-details");
                }}
              >
                <CardContent className="p-8 text-center flex flex-col items-center justify-center min-h-[280px] relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.02] via-transparent to-foreground/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-surface-secondary border border-border flex items-center justify-center mx-auto mb-5 group-hover:scale-110 transition-transform duration-300">
                      <PenTool className="h-7 w-7 text-muted group-hover:text-foreground transition-colors" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-2">
                      Start from Scratch
                    </h3>
                    <p className="text-sm text-muted mb-4 max-w-[260px] mx-auto leading-relaxed">
                      Fill in contract details manually step by step
                    </p>
                    <div className="mt-5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs font-semibold"
                        onPress={() => {
                          setMode("manual");
                          setStep("manual-details");
                        }}
                      >
                        <PenTool className="h-3.5 w-3.5 mr-1.5" />
                        Get Started
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick template for testing */}
            <div className="text-center">
              <button
                onClick={loadTemplate}
                className="text-xs text-muted hover:text-accent transition-colors underline underline-offset-4"
              >
                Demo template
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.md,.json"
              onChange={handleFileSelect}
              className="hidden"
            />
          </motion.div>
        )}

        {/* ── AI Processing Animation ────────────────────────────────────── */}
        {step === "choose" && aiProcessing && (
          <motion.div
            key="ai-processing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <Card className="border border-border">
              <CardContent className="p-12 text-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  className="w-16 h-16 mx-auto mb-6"
                >
                  <Brain className="h-16 w-16 text-accent" />
                </motion.div>
                <h3 className="text-xl font-bold text-foreground mb-2">
                  Processing Document
                </h3>
                <p className="text-sm text-muted mb-8">
                  {uploadedFileName}
                </p>
                <div className="max-w-sm mx-auto space-y-4">
                  {PROCESSING_MESSAGES.map((msg, i) => (
                    <motion.div
                      key={msg}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{
                        opacity: i <= aiProcessingStep ? 1 : 0.3,
                        x: 0,
                      }}
                      transition={{ delay: i * 0.2, duration: 0.4 }}
                      className="flex items-center gap-3"
                    >
                      {i < aiProcessingStep ? (
                        <CheckCircle className="h-4 w-4 text-success shrink-0" />
                      ) : i === aiProcessingStep ? (
                        <Loader2 className="h-4 w-4 text-accent animate-spin shrink-0" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border border-border shrink-0" />
                      )}
                      <span
                        className={`text-sm ${
                          i <= aiProcessingStep
                            ? "text-foreground font-medium"
                            : "text-muted"
                        }`}
                      >
                        {msg}
                      </span>
                    </motion.div>
                  ))}
                </div>
                {aiError && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-6 p-4 rounded-xl bg-danger/10 border border-danger/30"
                  >
                    <p className="text-sm text-danger font-medium">{aiError}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3 text-danger border-danger/30"
                      onPress={() => {
                        setAiProcessing(false);
                        setAiError(null);
                      }}
                    >
                      Try Again
                    </Button>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── Step 2A: AI Review ─────────────────────────────────────────── */}
        {step === "ai-review" && (
          <motion.div key="ai-review" {...fadeIn}>
            <Card className="border border-border">
              <CardContent className="p-0">
                {/* Confidence Banner */}
                <div className="px-6 sm:px-8 py-4 bg-accent/5 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Brain className="h-5 w-5 text-accent" />
                    <span className="text-sm font-bold text-foreground">
                      AI Confidence: {aiConfidence}%
                    </span>
                  </div>
                  <Chip size="sm" variant="soft" color="success" className="text-xs font-semibold">
                    {milestones.length} milestones extracted
                  </Chip>
                </div>

                <div className="p-6 sm:p-8 space-y-6">
                  {/* Title */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-xs font-bold text-muted uppercase tracking-wider">
                        Title
                      </label>
                      {aiFields.has("title") && <AiChip />}
                    </div>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      variant="secondary"
                      className="w-full text-lg font-semibold"
                      placeholder="Contract title"
                    />
                  </div>

                  {/* Categories */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <label className="text-xs font-bold text-muted uppercase tracking-wider">
                        Category
                      </label>
                      {aiFields.has("category") && <AiChip />}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(showAllCategories ? CATEGORIES : CATEGORIES.slice(0, 6)).map((cat) => (
                        <Chip
                          key={cat}
                          size="sm"
                          variant={categories.includes(cat) ? "primary" : "soft"}
                          color={categories.includes(cat) ? "accent" : "default"}
                          className={`cursor-pointer text-xs font-semibold transition-all ${
                            categories.includes(cat) ? "" : "hover:border-accent/50"
                          }`}
                          onClick={() => toggleCategory(cat)}
                        >
                          {CATEGORY_LABELS[cat]}
                        </Chip>
                      ))}
                      {!showAllCategories && (
                        <Chip
                          size="sm"
                          variant="soft"
                          color="default"
                          className="cursor-pointer text-xs font-semibold hover:border-accent/50"
                          onClick={() => setShowAllCategories(true)}
                        >
                          + {CATEGORIES.length - 6} more
                        </Chip>
                      )}
                    </div>
                    {categories.includes("other") && (
                      <Input
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        placeholder="Enter custom category..."
                        variant="secondary"
                        className="w-full mt-3"
                      />
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-xs font-bold text-muted uppercase tracking-wider">
                        Description
                      </label>
                      {aiFields.has("description") && <AiChip />}
                    </div>
                    <TextArea
                      value={description}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        setDescription(e.target.value)
                      }
                      variant="secondary"
                      className="w-full"
                      rows={3}
                      placeholder="Contract description..."
                    />
                  </div>

                  {/* Client */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-xs font-bold text-muted uppercase tracking-wider">
                        Client
                      </label>
                      <Chip
                        size="sm"
                        variant="soft"
                        color="warning"
                        className="text-[10px] font-bold uppercase tracking-wider"
                      >
                        Required
                      </Chip>
                    </div>
                    <Input
                      value={counterparty}
                      onChange={(e) => setCounterparty(e.target.value)}
                      variant="secondary"
                      className="w-full"
                      placeholder="client@company.com or 0x..."
                    />
                    {counterparty ? (
                      <p className="text-xs mt-1.5 flex items-center gap-1">
                        {counterpartyIsEmail ? (
                          <>
                            <Mail className="h-3 w-3 text-accent" />
                            <span className="text-accent">An invitation email will be sent</span>
                          </>
                        ) : (
                          <>
                            <Wallet className="h-3 w-3 text-muted" />
                            <span className="text-muted">Contract will be created directly with this address</span>
                          </>
                        )}
                      </p>
                    ) : (
                      <p className="text-xs mt-1.5 text-muted">Enter client email to send an invitation, or wallet address to link directly</p>
                    )}
                  </div>

                  {/* Milestones */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-muted uppercase tracking-wider">
                          Milestones ({milestones.length} extracted)
                        </label>
                        {aiFields.has("milestones") && <AiChip />}
                      </div>
                      <span className="text-sm font-bold text-accent tabular-nums">
                        Total: ${totalAmount.toLocaleString()}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {milestones.map((m, i) => (
                        <MilestoneRow
                          key={m.id}
                          milestone={m}
                          index={i}
                          expanded={expandedMilestone === m.id}
                          onToggle={() =>
                            setExpandedMilestone(
                              expandedMilestone === m.id ? null : m.id,
                            )
                          }
                          onChange={(patch) => setMilestone(m.id, patch)}
                          onRemove={() => removeMilestone(m.id)}
                          canRemove={milestones.length > 1}
                        />
                      ))}
                      <button
                        onClick={addMilestone}
                        className="w-full border border-dashed border-border rounded-xl py-3 text-sm font-semibold text-muted hover:text-foreground hover:border-accent/50 hover:bg-surface-secondary transition-all flex items-center justify-center gap-2"
                      >
                        <Plus className="h-4 w-4" /> Add Milestone
                      </button>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 sm:px-8 py-4 border-t border-border bg-surface-secondary">
                  <Button
                    variant="ghost"
                    onPress={goBack}
                    className="text-muted hover:text-foreground"
                  >
                    <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
                  </Button>
                  <Button
                    onPress={goNext}
                    isDisabled={!title || milestones.length === 0}
                    className="bg-foreground text-background text-sm font-bold rounded-lg px-5 h-9 active:scale-[0.98] transition-all"
                  >
                    Continue to Fees <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── Step 2B: Manual Details ────────────────────────────────────── */}
        {step === "manual-details" && (
          <motion.div key="manual-details" {...fadeIn}>
            <Card className="border border-border">
              <CardContent className="p-0">
                <div className="p-6 sm:p-8 space-y-6">
                  <div>
                    <h2 className="text-lg font-bold mb-1">Contract Details</h2>
                    <p className="text-sm text-muted">
                      Define the core information for your contract.
                    </p>
                  </div>

                  <FormField label="Contract Title" required>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      variant="secondary"
                      className="w-full"
                      placeholder="e.g. E-Commerce Platform Redesign"
                    />
                  </FormField>

                  <FormField
                    label="Client email"
                    hint="An invitation with a payment link will be sent to the client"
                    required
                  >
                    <Input
                      value={counterparty}
                      onChange={(e) => setCounterparty(e.target.value)}
                      variant="secondary"
                      className="w-full"
                      placeholder="client@company.com"
                    />
                  </FormField>

                  <FormField label="Description">
                    <TextArea
                      value={description}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        setDescription(e.target.value)
                      }
                      variant="secondary"
                      className="w-full"
                      rows={3}
                      placeholder="Brief description of the engagement..."
                    />
                  </FormField>

                  {/* Category chips */}
                  <div>
                    <label className="text-sm font-medium mb-3 block">
                      Category
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(showAllCategories ? CATEGORIES : CATEGORIES.slice(0, 6)).map((cat) => (
                        <Chip
                          key={cat}
                          size="sm"
                          variant={categories.includes(cat) ? "primary" : "soft"}
                          color={categories.includes(cat) ? "accent" : "default"}
                          className={`cursor-pointer text-xs font-semibold transition-all ${
                            categories.includes(cat) ? "" : "hover:border-accent/50"
                          }`}
                          onClick={() => toggleCategory(cat)}
                        >
                          {CATEGORY_LABELS[cat]}
                        </Chip>
                      ))}
                      {!showAllCategories && (
                        <Chip
                          size="sm"
                          variant="soft"
                          color="default"
                          className="cursor-pointer text-xs font-semibold hover:border-accent/50"
                          onClick={() => setShowAllCategories(true)}
                        >
                          + {CATEGORIES.length - 6} more
                        </Chip>
                      )}
                    </div>
                    {categories.includes("other") && (
                      <Input
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        placeholder="Enter custom category..."
                        variant="secondary"
                        className="w-full mt-3"
                      />
                    )}
                  </div>

                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 sm:px-8 py-4 border-t border-border bg-surface-secondary">
                  <Button
                    variant="ghost"
                    onPress={goBack}
                    className="text-muted hover:text-foreground"
                  >
                    <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
                  </Button>
                  <Button
                    onPress={goNext}
                    isDisabled={!title?.trim() || !counterparty?.trim()}
                    className="bg-foreground text-background text-sm font-bold rounded-lg px-5 h-9 active:scale-[0.98] transition-all"
                  >
                    Next: Milestones <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── Step 3: Manual Milestones ──────────────────────────────────── */}
        {step === "manual-milestones" && (
          <motion.div key="manual-milestones" {...fadeIn}>
            <Card className="border border-border">
              <CardContent className="p-0">
                <div className="p-6 sm:p-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold mb-1">Milestones</h2>
                      <p className="text-sm text-muted">
                        Define deliverables and payment schedule.
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted font-medium">
                        Total Value
                      </div>
                      <div className="text-xl font-bold text-accent tabular-nums">
                        ${totalAmount.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {milestones.length === 0 && (
                      <div className="text-center py-8 text-muted">
                        <FileText className="h-8 w-8 mx-auto mb-3 opacity-40" />
                        <p className="text-sm font-medium">No milestones yet</p>
                        <p className="text-xs mt-1">
                          Add your first milestone below
                        </p>
                      </div>
                    )}
                    {milestones.map((m, i) => (
                      <MilestoneRow
                        key={m.id}
                        milestone={m}
                        index={i}
                        expanded={expandedMilestone === m.id}
                        onToggle={() =>
                          setExpandedMilestone(
                            expandedMilestone === m.id ? null : m.id,
                          )
                        }
                        onChange={(patch) => setMilestone(m.id, patch)}
                        onRemove={() => removeMilestone(m.id)}
                        canRemove={milestones.length > 1}
                      />
                    ))}
                    <button
                      onClick={addMilestone}
                      className="w-full border border-dashed border-border rounded-xl py-3 text-sm font-semibold text-muted hover:text-foreground hover:border-accent/50 hover:bg-surface-secondary transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="h-4 w-4" /> Add Milestone
                    </button>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 sm:px-8 py-4 border-t border-border bg-surface-secondary">
                  <Button
                    variant="ghost"
                    onPress={goBack}
                    className="text-muted hover:text-foreground"
                  >
                    <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
                  </Button>
                  <Button
                    onPress={goNext}
                    isDisabled={milestones.length === 0}
                    className="bg-foreground text-background text-sm font-bold rounded-lg px-5 h-9 active:scale-[0.98] transition-all"
                  >
                    Next: Fees <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── Step 4: Fees & Business Dev ────────────────────────────────── */}
        {step === "fees" && (
          <motion.div key="fees" {...fadeIn}>
            <Card className="border border-border">
              <CardContent className="p-0">
                <div className="p-6 sm:p-8 space-y-6">
                  <div>
                    <h2 className="text-lg font-bold mb-1">
                      Fees & Business Development
                    </h2>
                    <p className="text-sm text-muted">
                      Configure commission splits and payment method.
                    </p>
                  </div>

                  {/* BD Toggle */}
                  <div className="border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-surface-secondary border border-border flex items-center justify-center">
                          <Wallet className="h-4 w-4 text-muted" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-foreground">
                            Business Development Partner
                          </div>
                          <div className="text-xs text-muted">
                            Split commission with a BD referral
                          </div>
                        </div>
                      </div>
                      <label className="relative inline-flex shrink-0 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={bdEnabled}
                          onChange={(e) => setBdEnabled(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5 rounded-full bg-border peer-checked:bg-accent transition-colors after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-5" />
                      </label>
                    </div>

                    <AnimatePresence>
                      {bdEnabled && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-3 pt-3 border-t border-border">
                            <FormField
                              label="BD Wallet Address"
                              hint="Wallet that will receive the BD commission"
                            >
                              <Input
                                value={bdWallet}
                                onChange={(e) => setBdWallet(e.target.value)}
                                variant="secondary"
                                className="w-full font-mono text-sm"
                                placeholder="0x..."
                              />
                            </FormField>
                            <FormField
                              label={`Commission: ${bdPercent}%`}
                              hint="Percentage of total contract value"
                            >
                              <input
                                type="range"
                                min={1}
                                max={20}
                                value={bdPercent}
                                onChange={(e) =>
                                  setBdPercent(Number(e.target.value))
                                }
                                className="w-full accent-accent"
                              />
                              <div className="flex justify-between text-xs text-muted mt-1">
                                <span>1%</span>
                                <span>20%</span>
                              </div>
                            </FormField>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Fee Breakdown Visual */}
                  <div className="border border-border rounded-xl p-4 space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                      <BarChart3 className="h-4 w-4 text-muted" />
                      <span className="text-sm font-semibold text-foreground">
                        Fee Breakdown
                      </span>
                    </div>

                    {/* Visual bar */}
                    <div className="h-8 rounded-lg overflow-hidden flex">
                      {totalAmount > 0 && (
                        <>
                          <div
                            className="bg-accent/80 flex items-center justify-center text-[10px] font-bold text-white transition-all"
                            style={{
                              width: `${(netAmount / totalAmount) * 100}%`,
                            }}
                          >
                            Agency
                          </div>
                          {bdEnabled && bdPercent > 0 && (
                            <div
                              className="bg-warning/70 flex items-center justify-center text-[10px] font-bold text-white transition-all"
                              style={{
                                width: `${(bdFee / totalAmount) * 100}%`,
                              }}
                            >
                              BD
                            </div>
                          )}
                          <div
                            className="bg-muted/30 flex items-center justify-center text-[10px] font-bold text-muted transition-all"
                            style={{
                              width: `${(platformFee / totalAmount) * 100}%`,
                            }}
                          >
                            Platform
                          </div>
                        </>
                      )}
                      {totalAmount === 0 && (
                        <div className="w-full bg-surface-secondary flex items-center justify-center text-xs text-muted">
                          No milestones added yet
                        </div>
                      )}
                    </div>

                    {/* Fee details */}
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="p-2 rounded-lg bg-surface-secondary">
                        <div className="text-xs text-muted mb-0.5">
                          Agency Net
                        </div>
                        <div className="text-sm font-bold text-foreground tabular-nums">
                          ${netAmount.toLocaleString()}
                        </div>
                      </div>
                      {bdEnabled && (
                        <div className="p-2 rounded-lg bg-surface-secondary">
                          <div className="text-xs text-muted mb-0.5">
                            BD ({bdPercent}%)
                          </div>
                          <div className="text-sm font-bold text-foreground tabular-nums">
                            ${bdFee.toLocaleString()}
                          </div>
                        </div>
                      )}
                      <div className="p-2 rounded-lg bg-surface-secondary">
                        <div className="text-xs text-muted mb-0.5">
                          Platform ({PLATFORM_FEE_PERCENT}%)
                        </div>
                        <div className="text-sm font-bold text-foreground tabular-nums">
                          ${platformFee.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Payment Method */}
                  <div className="border border-border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                        <ShieldCheck className="h-4 w-4 text-accent" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-foreground">
                          Smart Escrow (Crypto)
                        </div>
                        <div className="text-xs text-muted">
                          Funds secured on Arbitrum via Privy wallet
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 sm:px-8 py-4 border-t border-border bg-surface-secondary">
                  <Button
                    variant="ghost"
                    onPress={goBack}
                    className="text-muted hover:text-foreground"
                  >
                    <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
                  </Button>
                  <Button
                    onPress={goNext}
                    className="bg-foreground text-background text-sm font-bold rounded-lg px-5 h-9 active:scale-[0.98] transition-all"
                  >
                    Final Review <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── Step 5: Final Review & Deploy ──────────────────────────────── */}
        {step === "review" && (
          <motion.div key="review" {...fadeIn}>
            <Card className="border border-border">
              <CardContent className="p-0">
                <div className="p-6 sm:p-8 space-y-6">
                  <div>
                    <h2 className="text-lg font-bold mb-1">
                      Review & Deploy
                    </h2>
                    <p className="text-sm text-muted">
                      Confirm everything before deploying to Arbitrum.
                    </p>
                  </div>

                  {/* Contract Details */}
                  <div className="border border-border rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-surface-secondary border-b border-border">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted" />
                        <span className="text-sm font-semibold text-foreground">
                          Contract Details
                        </span>
                      </div>
                    </div>
                    <div className="p-4 space-y-2.5">
                      {[
                        { label: "Title", value: title || "Untitled" },
                        {
                          label: "Client",
                          value: counterparty || "Not specified",
                        },
                        {
                          label: "Category",
                          value: categories.length > 0
                            ? categories.map((c) => CATEGORY_LABELS[c]).join(", ")
                            : "None",
                        },
                        { label: "Role", value: "Agency (service provider)" },
                        ...(description
                          ? [{ label: "Description", value: description }]
                          : []),
                      ].map(({ label, value }) => (
                        <div
                          key={label}
                          className="flex justify-between items-start py-1.5 border-b last:border-0 border-border/50"
                        >
                          <span className="text-sm text-muted font-medium shrink-0">
                            {label}
                          </span>
                          <span className="text-sm font-semibold text-foreground text-right ml-4 max-w-[65%]">
                            {value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Milestones */}
                  <div className="border border-border rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-surface-secondary border-b border-border flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted" />
                        <span className="text-sm font-semibold text-foreground">
                          Milestones ({milestones.length})
                        </span>
                      </div>
                      <span className="text-sm font-bold text-accent tabular-nums">
                        ${totalAmount.toLocaleString()}
                      </span>
                    </div>
                    <div className="divide-y divide-border">
                      {milestones.map((m, i) => (
                        <div key={m.id} className="px-4 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent shrink-0">
                              {i + 1}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-foreground truncate">
                                {m.name || "Unnamed"}
                              </div>
                              {m.deadline && (
                                <div className="text-xs text-muted">
                                  Due:{" "}
                                  {new Date(m.deadline).toLocaleDateString(
                                    "en-US",
                                    {
                                      month: "short",
                                      year: "numeric",
                                    },
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          <span className="text-sm font-bold text-foreground tabular-nums shrink-0 ml-3">
                            ${m.amount.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Fee Summary */}
                  <div className="border border-border rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-surface-secondary border-b border-border">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted" />
                        <span className="text-sm font-semibold text-foreground">
                          Fee Breakdown
                        </span>
                      </div>
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted">Contract Value</span>
                        <span className="font-semibold text-foreground tabular-nums">
                          ${totalAmount.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted">
                          Platform Fee ({PLATFORM_FEE_PERCENT}%)
                        </span>
                        <span className="text-foreground tabular-nums">
                          -${platformFee.toLocaleString()}
                        </span>
                      </div>
                      {bdEnabled && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted">
                            BD Commission ({bdPercent}%)
                          </span>
                          <span className="text-foreground tabular-nums">
                            -${bdFee.toLocaleString()}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm pt-2 border-t border-border">
                        <span className="font-semibold text-foreground">
                          Net Amount
                        </span>
                        <span className="font-bold text-accent tabular-nums">
                          ${netAmount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Privacy note */}
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-accent/5 border border-accent/20">
                    <ShieldCheck className="h-5 w-5 text-accent shrink-0" />
                    <p className="text-xs text-muted leading-relaxed">
                      This contract will be deployed to{" "}
                      <span className="font-semibold text-foreground">
                        Arbitrum
                      </span>
                      . Only authorized parties can access contract details.
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 sm:px-8 py-4 border-t border-border bg-surface-secondary">
                  <Button
                    variant="ghost"
                    isDisabled={creating}
                    onPress={goBack}
                    className="text-muted hover:text-foreground"
                  >
                    <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
                  </Button>
                  {ready && !authenticated ? (
                    <div className="flex items-center gap-3">
                      <p className="text-sm text-warning">Please sign in first</p>
                      <Button
                        onPress={() => login()}
                        className="bg-accent text-accent-foreground text-sm font-bold rounded-lg px-6 h-10"
                      >
                        <Wallet className="h-4 w-4 mr-2" />
                        Sign In
                      </Button>
                    </div>
                  ) : (
                    <Button
                      isDisabled={creating}
                      onPress={handleSubmit}
                      className="bg-accent text-accent-foreground text-sm font-bold rounded-lg px-6 h-10 shadow-md shadow-accent/20 active:scale-[0.98] transition-all"
                    >
                      {creating ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Deploying...
                        </>
                      ) : (
                        <>
                          <Rocket className="h-4 w-4 mr-2" />
                          Deploy to Arbitrum
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>


      <div className="text-center mt-6">
        <span className="text-xs text-muted font-medium">
          Powered by TrustSignal Protocol
        </span>
      </div>
    </div>
  );
}

// ─── Invite Copy Button ──────────────────────────────────────────────────────

function InviteCopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <Button
      onPress={handleCopy}
      isIconOnly
      variant="outline"
      className="rounded-lg border-border h-11 w-11"
    >
      {copied ? (
        <Check className="h-4 w-4 text-success" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );
}

// ─── Milestone Row Component ──────────────────────────────────────────────────

function MilestoneRow({
  milestone,
  index,
  expanded,
  onToggle,
  onChange,
  onRemove,
  canRemove,
}: {
  milestone: LocalMilestone;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<LocalMilestone>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="border border-border rounded-xl bg-surface overflow-hidden"
    >
      {/* Collapsed row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-secondary transition-colors"
        onClick={onToggle}
      >
        <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent shrink-0">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground truncate">
              {milestone.name || "Unnamed Milestone"}
            </span>
            {milestone.aiDetected && (
              <Chip size="sm" variant="soft" color="accent" className="text-[9px] font-bold uppercase shrink-0">
                AI
              </Chip>
            )}
          </div>
        </div>
        <span className="text-sm font-bold text-foreground tabular-nums shrink-0 mr-2">
          ${milestone.amount.toLocaleString()}
        </span>
        {milestone.deadline && (
          <span className="text-xs text-muted shrink-0 hidden sm:block mr-2">
            {new Date(milestone.deadline).toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            })}
          </span>
        )}
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted shrink-0" />
        )}
      </div>

      {/* Expanded form */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border">
              <div className="grid sm:grid-cols-[1fr_140px_150px] gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted uppercase tracking-wider">
                    Name
                  </label>
                  <Input
                    value={milestone.name}
                    onChange={(e) => onChange({ name: e.target.value })}
                    variant="secondary"
                    className="w-full"
                    placeholder="Milestone name"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Amount
                  </label>
                  <Input
                    type="number"
                    value={milestone.amount.toString()}
                    onChange={(e) =>
                      onChange({ amount: Number(e.target.value) })
                    }
                    variant="secondary"
                    className="w-full font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Deadline
                  </label>
                  <Input
                    type="date"
                    value={milestone.deadline}
                    onChange={(e) =>
                      onChange({ deadline: e.target.value })
                    }
                    variant="secondary"
                    className="w-full"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">
                  Deliverable
                </label>
                <TextArea
                  placeholder="What exactly will be delivered?"
                  value={milestone.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    onChange({ description: e.target.value })
                  }
                  variant="secondary"
                  className="w-full"
                  rows={2}
                />
              </div>
              {canRemove && (
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={onRemove}
                    className="text-danger text-xs hover:bg-danger/10"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Remove
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
