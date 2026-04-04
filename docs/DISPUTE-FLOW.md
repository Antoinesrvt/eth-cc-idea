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
  → Start dispute → enters dispute resolution
```

## Dispute Flow (Current Implementation)

### Phase 1: Evidence Collection

```
Either party starts dispute (POST /api/contracts/[id]/dispute)
  → Dispute created in DB (phase: "evidence")
  → Both parties can submit evidence (text, links, file attachments)
  → Email notifications sent to both parties
```

### Phase 2: Arbitration Fee Payment

```
Both parties must pay arbitration fee
  → 1-month deadline to pay
  → Fee amount set at dispute creation

If one party doesn't pay within deadline:
  → They LOSE by default
  → Ruling enforced: on-chain refund via refundMilestone()
  → Email notification of default ruling

If both parties pay:
  → Phase transitions to "kleros_review" in DB
  → ⚠ NOT YET WIRED to actual Kleros court
```

### Phase 3: Review (NOT YET IMPLEMENTED)

Kleros court integration requires Arbitrum (Kleros v2 is native there). On Base Sepolia, disputes that reach this phase are marked in DB but not submitted to any external arbitration system.

**Future implementation would:**
1. Submit dispute to Kleros Core on Arbitrum
2. Submit all evidence via ERC-1497
3. Wait for juror ruling
4. Enforce ruling on-chain

## API Endpoints

All dispute actions go through a single endpoint:
`POST /api/contracts/[id]/dispute`

| Action | Input | Phase |
|---|---|---|
| `create` | `{ milestoneId, argument }` | Creates dispute |
| `pay_fee` | `{ disputeId }` | Pay arbitration fee |
| `check_deadline` | `{ disputeId }` | Check if deadline expired |
| `submit_evidence` | `{ disputeId, evidenceUri, description }` | Add evidence |

`GET /api/contracts/[id]/dispute` — returns all disputes for a contract.

## Phase Transitions

```
evidence        → (both submit, move to fee payment)
kleros_payment  → (both pay: kleros_review) OR (deadline expires: resolved)
kleros_review   → (future: jurors rule → resolved)
resolved        → final state
```
