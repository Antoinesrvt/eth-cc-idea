import { type NextRequest } from "next/server";
import { z } from "zod";
import { extractText } from "unpdf";
import { db, ensureInit } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { submitDeliverable, isBlockchainConfigured } from "@/lib/blockchain";
import { notifyUser } from "@/lib/email";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per file

async function extractFileText(file: File): Promise<{ text: string; mimeType: string }> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const mimeType = file.type;

  if (mimeType === "application/pdf") {
    const { text } = await extractText(buffer, { mergePages: true });
    return { text, mimeType };
  }

  if (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    file.name.endsWith(".txt") ||
    file.name.endsWith(".md") ||
    file.name.endsWith(".json")
  ) {
    return { text: new TextDecoder().decode(buffer), mimeType };
  }

  if (mimeType.startsWith("image/")) {
    return { text: `[Image: ${file.name}]`, mimeType };
  }

  return { text: `[File: ${file.name}]`, mimeType };
}

const DeliverSchema = z.object({
  milestoneId: z.number().int().positive(),
  proofHash: z.string().min(1),
  description: z.string().optional(),
  links: z.array(z.string()).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureInit();
    const { id } = await params;

    // Auth: only the agency can submit deliverables
    const auth = await requireRole(request, id, "agency");
    if ("error" in auth) return auth.error;

    // Parse body: multipart (with files) or JSON (without)
    const contentType = request.headers.get("content-type") ?? "";
    let milestoneId: number;
    let proofHash: string;
    let description: string | undefined;
    let links: string[] | undefined;
    let uploadedFiles: File[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      milestoneId = Number(formData.get("milestoneId"));
      proofHash = formData.get("proofHash") as string;
      description = (formData.get("description") as string) || undefined;
      const rawLinks = formData.getAll("links") as string[];
      links = rawLinks.length > 0 ? rawLinks : undefined;
      uploadedFiles = formData.getAll("files") as File[];

      const parsed = DeliverSchema.safeParse({ milestoneId, proofHash, description, links });
      if (!parsed.success) {
        return Response.json(
          { error: "Invalid input", details: parsed.error.flatten() },
          { status: 400 },
        );
      }
    } else {
      const body = await request.json();
      const parsed = DeliverSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json(
          { error: "Invalid input", details: parsed.error.flatten() },
          { status: 400 },
        );
      }
      milestoneId = parsed.data.milestoneId;
      proofHash = parsed.data.proofHash;
      description = parsed.data.description;
      links = parsed.data.links;
    }

    const contract = await db.contracts.findById(id);
    if (!contract) {
      return Response.json({ error: "Contract not found" }, { status: 404 });
    }

    const updated = await db.contracts.updateMilestone(id, milestoneId, {
      status: "delivered",
      proofHash,
      deliveredAt: new Date(),
    });

    // Attempt real on-chain deliverable submission if blockchain is configured
    if (isBlockchainConfigured() && contract.onChainAddress) {
      await db.blockchainEvents.tracked(
        { contractId: id, operation: "deliver", chain: "arbitrum", params: { milestoneId, proofHash } },
        async () => {
          const txHash = await submitDeliverable(contract.onChainAddress!, milestoneId, proofHash);
          return { txHash };
        },
      );
    }

    // Validate and extract text from uploaded files
    const fileContents: { filename: string; mimeType: string; text: string }[] = [];
    for (const file of uploadedFiles) {
      if (file.size > MAX_FILE_SIZE) {
        return Response.json(
          { error: `File "${file.name}" exceeds 10 MB limit.` },
          { status: 400 },
        );
      }
      const extracted = await extractFileText(file);
      fileContents.push({ filename: file.name, mimeType: extracted.mimeType, text: extracted.text });
    }

    // Store deliverable content in DB for dispute evidence
    const textContent = [
      description || "",
      ...(links || []).map((l: string) => `Link: ${l}`),
    ].filter(Boolean).join("\n\n");

    if (textContent) {
      try {
        await db.documents.create({
          refType: "deliverable",
          contractId: id,
          milestoneId,
          content: textContent,
          hash: proofHash,
          links: links || [],
        });
      } catch (docErr) {
        console.warn("[deliver/POST] Document storage warning:", docErr instanceof Error ? docErr.message : docErr);
      }
    }

    // Store each uploaded file as a separate document
    for (const fc of fileContents) {
      if (!fc.text.trim()) continue;
      try {
        await db.documents.create({
          refType: "deliverable",
          contractId: id,
          milestoneId,
          filename: fc.filename,
          mimeType: fc.mimeType,
          content: fc.text,
          hash: proofHash,
          links: [],
        });
      } catch (docErr) {
        console.warn(`[deliver/POST] File document storage warning (${fc.filename}):`, docErr instanceof Error ? docErr.message : docErr);
      }
    }

    // Notify client that a deliverable was submitted
    const milestone = updated.milestones.find((m) => m.id === milestoneId);
    if (contract.client) {
      notifyUser(contract.client, {
        type: "deliverable_submitted",
        contractTitle: contract.title,
        contractId: id,
        milestoneName: milestone?.name,
      });
    }

    return Response.json(updated);
  } catch (error) {
    console.error("[deliver/POST] Error:", error);
    return Response.json(
      { error: "Failed to submit deliverable. Please try again." },
      { status: 500 },
    );
  }
}
