export type PaymentMethod = "crypto";

export type EscrowStatus =
  | "pending"
  | "deposited"
  | "partially_released"
  | "fully_released"
  | "refunded";

export interface EscrowDeposit {
  id: string;
  amount: number;
  method: PaymentMethod;
  txHash?: string;
  confirmedAt?: Date;
}

export interface EscrowState {
  contractId: string;
  totalAmount: number;
  depositedAmount: number;
  releasedAmount: number;
  status: EscrowStatus;
  deposits: EscrowDeposit[];
}
