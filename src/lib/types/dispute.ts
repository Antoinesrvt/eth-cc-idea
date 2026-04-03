export type DisputePhase =
  | "evidence"        // both parties submitting evidence
  | "kleros_payment"  // both need to pay arbitration fee
  | "kleros_review"   // jurors reviewing
  | "resolved";       // done

/** Kleros ruling: 0 = refused to arbitrate, 1 = client wins, 2 = agency wins */
export type KlerosRuling = 0 | 1 | 2;

export interface PartyResponse {
  party: "client" | "agency";
  accepted: boolean;
  respondedAt: Date;
}

export interface DisputeEvidence {
  party: "client" | "agency" | "system";
  type:
    | "contract_spec"
    | "deliverable"
    | "argument"
    | "document";
  /** IPFS hash or on-chain reference */
  uri: string;
  description: string;
  submittedAt: Date;
}

export interface Dispute {
  id: string;
  contractId: string;
  milestoneId: number;
  phase: DisputePhase;

  /** Who initiated the dispute */
  initiatedBy: "client" | "agency";

  /** Both parties' responses (kept for backwards compat, not used in new flow) */
  partyResponses: PartyResponse[];

  /** Kleros */
  klerosDisputeId?: string;
  /** Arbitration fee per party */
  arbitrationFee?: number;
  clientFeePaid: boolean;
  agencyFeePaid: boolean;
  /** 1 month from escalation to kleros_payment */
  feeDeadline?: Date;
  /** Kleros ruling: 0=refused, 1=client wins, 2=agency wins */
  ruling?: KlerosRuling;

  /** Evidence submitted by parties */
  evidence: DisputeEvidence[];

  createdAt: Date;
  resolvedAt?: Date;
}
