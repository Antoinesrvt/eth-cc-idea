import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { db, clearAll, ensureInit } from "@/lib/db";

beforeAll(async () => {
  await ensureInit();
});

async function clearStore() {
  await clearAll();
}

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------

describe("db.contracts", () => {
  beforeEach(async () => { await clearStore(); });

  const validInput = () => ({
    title: "Test Contract",
    description: "A test contract",
    category: "development" as const,
    creatorRole: "agency" as const,
    client: "0xClient1111111111111111111111111111111111",
    agency: "0xAgency2222222222222222222222222222222222",
    milestones: [
      {
        name: "Milestone 1",
        description: "First milestone",
        amount: 5000,
        deadline: new Date("2026-06-01"),
      },
      {
        name: "Milestone 2",
        description: "Second milestone",
        amount: 3000,
        deadline: new Date("2026-07-01"),
      },
    ],
  });

  it("creates a contract with all fields", async () => {
    const input = validInput();
    const contract = await db.contracts.createContract(input);

    expect(contract.id).toBeDefined();
    expect(contract.title).toBe("Test Contract");
    expect(contract.description).toBe("A test contract");
    expect(contract.category).toBe("development");
    expect(contract.creatorRole).toBe("agency");
    expect(contract.client).toBe("0xClient1111111111111111111111111111111111");
    expect(contract.agency).toBe("0xAgency2222222222222222222222222222222222");
    expect(contract.milestones).toHaveLength(2);
    expect(contract.milestones[0].id).toBe(1);
    expect(contract.milestones[0].status).toBe("pending");
    expect(contract.milestones[1].id).toBe(2);
    expect(contract.totalValue).toBe(8000);
    expect(contract.status).toBe("draft");
    expect(contract.platformFeePercent).toBe(2.5);
    expect(contract.createdAt).toBeInstanceOf(Date);
    expect(contract.updatedAt).toBeInstanceOf(Date);
  });

  it("finds contract by ID", async () => {
    const contract = await db.contracts.createContract(validInput());
    const found = await db.contracts.findById(contract.id);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(contract.id);
    expect(found!.title).toBe("Test Contract");
  });

  it("finds contracts by user address (as client)", async () => {
    const input = validInput();
    await db.contracts.createContract(input);
    await db.contracts.createContract({
      ...input,
      client: "0xOtherClient000000000000000000000000000000",
    });

    const results = await db.contracts.findByUser(input.client);
    expect(results).toHaveLength(1);
    expect(results[0].client).toBe(input.client);
  });

  it("finds contracts by user address (as agency)", async () => {
    const input = validInput();
    await db.contracts.createContract(input);

    const results = await db.contracts.findByUser(input.agency);
    expect(results).toHaveLength(1);
    expect(results[0].agency).toBe(input.agency);
  });

  it("updates a contract", async () => {
    const contract = await db.contracts.createContract(validInput());
    const updated = await db.contracts.update(contract.id, {
      status: "active",
      title: "Updated Title",
    });

    expect(updated.status).toBe("active");
    expect(updated.title).toBe("Updated Title");
    expect(updated.id).toBe(contract.id);
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
      contract.updatedAt.getTime(),
    );
  });

  it("updates a milestone status", async () => {
    const contract = await db.contracts.createContract(validInput());
    const updated = await db.contracts.updateMilestone(contract.id, 1, {
      status: "delivered",
      proofHash: "QmTest123",
    });

    expect(updated.milestones[0].status).toBe("delivered");
    expect(updated.milestones[0].proofHash).toBe("QmTest123");
    expect(updated.milestones[0].id).toBe(1);
  });

  it("lists all contracts", async () => {
    const input = validInput();
    await db.contracts.createContract(input);
    await db.contracts.createContract({ ...input, title: "Second Contract" });

    const all = await db.contracts.list();
    expect(all).toHaveLength(2);
  });

  it("returns null for non-existent contract", async () => {
    const found = await db.contracts.findById("non-existent-id");
    expect(found).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Escrows
// ---------------------------------------------------------------------------

describe("db.escrows", () => {
  beforeEach(async () => { await clearStore(); });

  const CONTRACT_ID = "test-contract-1";

  it("creates an escrow linked to a contract", async () => {
    const escrow = await db.escrows.createEscrow(CONTRACT_ID, 10000);

    expect(escrow.contractId).toBe(CONTRACT_ID);
    expect(escrow.totalAmount).toBe(10000);
    expect(escrow.depositedAmount).toBe(0);
    expect(escrow.releasedAmount).toBe(0);
    expect(escrow.status).toBe("pending");
    expect(escrow.deposits).toHaveLength(0);
  });

  it("adds a deposit and tracks amounts", async () => {
    await db.escrows.createEscrow(CONTRACT_ID, 10000);

    const escrow = await db.escrows.addDeposit(CONTRACT_ID, {
      amount: 5000,
      method: "crypto",
      txHash: "0xabc123",
      confirmedAt: new Date(),
    });

    expect(escrow.depositedAmount).toBe(5000);
    expect(escrow.deposits).toHaveLength(1);
    expect(escrow.deposits[0].amount).toBe(5000);
    expect(escrow.deposits[0].id).toBeDefined();
    expect(escrow.status).toBe("pending");

    const full = await db.escrows.addDeposit(CONTRACT_ID, {
      amount: 5000,
      method: "crypto",
      txHash: "0xdef456",
    });

    expect(full.depositedAmount).toBe(10000);
    expect(full.status).toBe("deposited");
    expect(full.deposits).toHaveLength(2);
  });

  it("releases escrow funds", async () => {
    await db.escrows.createEscrow(CONTRACT_ID, 10000);
    await db.escrows.addDeposit(CONTRACT_ID, {
      amount: 10000,
      method: "crypto",
      txHash: "0xabc",
    });

    const partial = await db.escrows.release(CONTRACT_ID, 3000);
    expect(partial.releasedAmount).toBe(3000);
    expect(partial.status).toBe("partially_released");

    const full = await db.escrows.release(CONTRACT_ID, 7000);
    expect(full.releasedAmount).toBe(10000);
    expect(full.status).toBe("fully_released");
  });

  it("refunds escrow", async () => {
    await db.escrows.createEscrow(CONTRACT_ID, 5000);
    await db.escrows.addDeposit(CONTRACT_ID, {
      amount: 5000,
      method: "crypto",
    });

    const refunded = await db.escrows.refund(CONTRACT_ID);
    expect(refunded.status).toBe("refunded");
  });
});

// ---------------------------------------------------------------------------
// Disputes
// ---------------------------------------------------------------------------

describe("db.disputes", () => {
  beforeEach(async () => { await clearStore(); });

  const createTestDispute = () =>
    db.disputes.createDispute({
      contractId: "contract-1",
      milestoneId: 2,
      phase: "evidence",
      evidence: [
        {
          party: "client",
          type: "argument",
          uri: "QmTest123",
          description: "The deliverable is incomplete",
          submittedAt: new Date(),
        },
      ],
      initiatedBy: "client",
      partyResponses: [],
      clientFeePaid: false,
      agencyFeePaid: false,
    });

  it("creates a dispute", async () => {
    const dispute = await createTestDispute();

    expect(dispute.id).toBeDefined();
    expect(dispute.contractId).toBe("contract-1");
    expect(dispute.milestoneId).toBe(2);
    expect(dispute.phase).toBe("evidence");
    expect(dispute.evidence).toHaveLength(1);
    expect(dispute.createdAt).toBeInstanceOf(Date);
  });

  it("finds disputes by contract", async () => {
    await createTestDispute();
    await db.disputes.createDispute({
      contractId: "contract-2",
      milestoneId: 1,
      phase: "evidence",
      initiatedBy: "client",
      partyResponses: [],
      clientFeePaid: false,
      agencyFeePaid: false,
      evidence: [],
    });

    const results = await db.disputes.findByContract("contract-1");
    expect(results).toHaveLength(1);
    expect(results[0].contractId).toBe("contract-1");
  });

  it("adds evidence to a dispute", async () => {
    const dispute = await createTestDispute();

    const updated = await db.disputes.addEvidence(dispute.id, {
      party: "agency",
      type: "argument",
      uri: "QmResponse456",
      description: "We delivered everything as specified",
      submittedAt: new Date(),
    });

    expect(updated.evidence).toHaveLength(2);
    expect(updated.evidence[1].party).toBe("agency");
  });

  it("updates dispute phase", async () => {
    const dispute = await createTestDispute();

    const updated = await db.disputes.update(dispute.id, {
      phase: "kleros_review",
      klerosDisputeId: "kleros-123",
    });

    expect(updated.phase).toBe("kleros_review");
    expect(updated.klerosDisputeId).toBe("kleros-123");
    expect(updated.id).toBe(dispute.id);
  });

  it("records fee payment per party", async () => {
    const dispute = await createTestDispute();
    await db.disputes.update(dispute.id, {
      phase: "kleros_payment",
      feeDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    const afterClient = await db.disputes.recordFeePaid(dispute.id, "client");
    expect(afterClient.clientFeePaid).toBe(true);
    expect(afterClient.agencyFeePaid).toBe(false);
    expect(afterClient.phase).toBe("kleros_payment");

    const afterBoth = await db.disputes.recordFeePaid(dispute.id, "agency");
    expect(afterBoth.agencyFeePaid).toBe(true);
    expect(afterBoth.phase).toBe("kleros_payment");
  });

  it("defaults winner when fee deadline expires", async () => {
    const dispute = await createTestDispute();
    await db.disputes.update(dispute.id, {
      phase: "kleros_payment",
      feeDeadline: new Date(Date.now() - 1000),
      clientFeePaid: true,
      agencyFeePaid: false,
    });

    const result = await db.disputes.checkFeeDeadline(dispute.id);
    expect(result.expired).toBe(true);
    expect(result.defaultWinner).toBe("client");
  });

  it("does not default winner when deadline not expired", async () => {
    const dispute = await createTestDispute();
    await db.disputes.update(dispute.id, {
      phase: "kleros_payment",
      feeDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      clientFeePaid: true,
      agencyFeePaid: false,
    });

    const result = await db.disputes.checkFeeDeadline(dispute.id);
    expect(result.expired).toBe(false);
    expect(result.defaultWinner).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

describe("db.users", () => {
  beforeEach(async () => { await clearStore(); });

  const ADDR = "0xUser1111111111111111111111111111111111111";

  it("creates a user with roles", async () => {
    const user = await db.users.createUser({
      address: ADDR,
      name: "Test Agency",
      email: "test@agency.io",
      roles: ["agency"],
    });

    expect(user.address).toBe(ADDR);
    expect(user.name).toBe("Test Agency");
    expect(user.email).toBe("test@agency.io");
    expect(user.roles).toEqual(["agency"]);
    expect(user.createdAt).toBeInstanceOf(Date);
  });

  it("finds user by address", async () => {
    await db.users.createUser({ address: ADDR, roles: ["client"] });

    const found = await db.users.findByAddress(ADDR);
    expect(found).not.toBeNull();
    expect(found!.address).toBe(ADDR);

    const missing = await db.users.findByAddress("0xNonExistent");
    expect(missing).toBeNull();
  });

  it("upserts user data", async () => {
    await db.users.createUser({ address: ADDR, name: "Original", roles: ["client"] });

    const updated = await db.users.upsert(ADDR, { name: "Updated Name" });
    expect(updated.name).toBe("Updated Name");
    expect(updated.address).toBe(ADDR);

    const NEW_ADDR = "0xNew0000000000000000000000000000000000000";
    const created = await db.users.upsert(NEW_ADDR, {
      name: "New User",
      roles: ["investor"],
    });
    expect(created.address).toBe(NEW_ADDR);
    expect(created.name).toBe("New User");
  });

  it("updates agency score", async () => {
    await db.users.createUser({ address: ADDR, roles: ["agency"] });

    const updated = await db.users.updateAgencyScore(ADDR, {
      score: 85,
      contractsCompleted: 10,
      verified: true,
    });

    expect(updated.agencyProfile).toBeDefined();
    expect(updated.agencyProfile!.score).toBe(85);
    expect(updated.agencyProfile!.contractsCompleted).toBe(10);
    expect(updated.agencyProfile!.verified).toBe(true);
    expect(updated.agencyProfile!.contractsFailed).toBe(0);
  });
});
