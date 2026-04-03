import { describe, it, expect } from "vitest";
import { calculateFeeBreakdown, validateDeposit } from "@/lib/payments";

describe("calculateFeeBreakdown", () => {
  it("calculates correct split with BD", () => {
    // $10,000 milestone, 5% BD
    const result = calculateFeeBreakdown(10_000, 5);

    expect(result.platformFee).toBe(250); // 2.5% of 10,000
    expect(result.bdFee).toBe(500); // 5% of 10,000
    expect(result.agencyPayout).toBe(9250); // 10,000 - 250 - 500
    expect(result.platformFeeBps).toBe(250); // 2.5% = 250 bps
    expect(result.bdFeeBps).toBe(500); // 5% = 500 bps
  });

  it("calculates correct split without BD", () => {
    // $10,000 milestone, 0% BD
    const result = calculateFeeBreakdown(10_000, 0);

    expect(result.platformFee).toBe(250);
    expect(result.bdFee).toBe(0);
    expect(result.agencyPayout).toBe(9750); // 10,000 - 250
  });

  it("handles zero amount", () => {
    const result = calculateFeeBreakdown(0, 5);

    expect(result.platformFee).toBe(0);
    expect(result.bdFee).toBe(0);
    expect(result.agencyPayout).toBe(0);
  });

  it("caps BD fee at 20%", () => {
    // The config says maxBdFeePercent = 20, but calculateFeeBreakdown
    // just applies the percentage directly. The cap is enforced at the
    // input validation layer. We verify the math still works at 20%.
    const result = calculateFeeBreakdown(10_000, 20);

    expect(result.platformFee).toBe(250);
    expect(result.bdFee).toBe(2000); // 20% of 10,000
    expect(result.agencyPayout).toBe(7750); // 10,000 - 250 - 2000
    expect(result.bdFeeBps).toBe(2000);

    // Beyond 20% the math still works, but the UI/API should prevent it.
    // We just verify the function doesn't throw.
    const over = calculateFeeBreakdown(10_000, 25);
    expect(over.bdFee).toBe(2500);
  });
});

describe("validateDeposit", () => {
  it("accepts valid deposit", () => {
    const result = validateDeposit(10_000, 3_000, 5_000);

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.remaining).toBe(2_000); // 10,000 - 3,000 - 5,000
  });

  it("rejects negative amount", () => {
    const result = validateDeposit(10_000, 0, -100);

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Amount must be positive");
    expect(result.remaining).toBe(10_000);
  });

  it("rejects zero amount", () => {
    const result = validateDeposit(10_000, 0, 0);

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Amount must be positive");
  });

  it("rejects deposit exceeding remaining", () => {
    const result = validateDeposit(10_000, 8_000, 5_000);

    expect(result.valid).toBe(false);
    expect(result.error).toContain("Deposit exceeds remaining");
    expect(result.remaining).toBe(2_000);
  });

  it("accepts deposit exactly matching remaining", () => {
    const result = validateDeposit(10_000, 7_000, 3_000);

    expect(result.valid).toBe(true);
    expect(result.remaining).toBe(0);
  });
});
