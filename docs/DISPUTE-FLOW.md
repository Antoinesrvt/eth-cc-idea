# TrustSignal — Dispute Resolution Flow

## Milestone Lifecycle

```
Client creates contract with milestones
  → Client deposits escrow
  → Contract becomes "active"

Agency delivers milestone (submits proof)
  → Milestone: pending → delivered

Client reviews:
  → Approve → escrow released (2.5% platform + BD% + agency)
  → Reject (with reason) → milestone: rejected

Agency sees rejection:
  → Accept rejection → milestone stays rejected, agency can rework
  → Start dispute → enters 2-phase dispute resolution
```

## Phase 1: AI Review

```
Either party starts dispute
  → AI analyzes:
    - Contract specification
    - Deliverable proof
    - Client's argument
    - Agency's argument
  → AI gives verdict:
    - Score (0-100)
    - Approved or Rejected
    - Detailed reasoning
    - Met/unmet requirements list

Both parties see the AI verdict
  → ACCEPT or REJECT buttons for each party

If both accept:
  → AI ruling enforced
  → Milestone approved or rejected based on AI verdict
  → Dispute resolved

If either rejects:
  → Escalate to Phase 2 (Kleros Court)
```

## Phase 2: Decentralized Court (Kleros)

```
Both parties must pay arbitration fee
  → ~0.05-0.1 ETH per party
  → 1 month deadline to pay

If one party doesn't pay within deadline:
  → They LOSE by default
  → Other party gets their fee refunded
  → Ruling enforced in favor of the party who paid

If both parties pay:
  → Dispute submitted to Kleros Court on Arbitrum
  → AI verdict + all evidence submitted to jurors
  → 3-7 random jurors review the case
  → 3-5 day deliberation period
  → Ruling: client wins OR agency wins

Winner:
  → Gets their arbitration fee refunded (from loser's deposit)
  → Milestone enforced per ruling (approved or rejected + refund)
```

## API Endpoints

All dispute actions go through a single endpoint:
`POST /api/contracts/[id]/dispute`

| Action | Input | Phase |
|---|---|---|
| `create` | `{ milestoneId, argument }` | Creates dispute, runs AI |
| `respond` | `{ disputeId, accepted, argument? }` | Both parties respond to AI |
| `pay_fee` | `{ disputeId }` | Pay Kleros arbitration fee |
| `check_deadline` | `{ disputeId }` | Check if deadline expired |
| `submit_evidence` | `{ disputeId, evidenceUri, description }` | Add evidence |

`GET /api/contracts/[id]/dispute` — returns all disputes for a contract.

## Phase Transitions

```
ai_review       → (AI completes analysis)
ai_verdict      → (both accept: resolved) OR (either rejects: kleros_payment)
kleros_payment  → (both pay: kleros_review) OR (deadline expires: resolved)
kleros_review   → (jurors rule: resolved)
resolved        → final state
```
