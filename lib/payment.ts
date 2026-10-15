/** Future escrow adapters must implement this boundary; v1 never transfers funds. */
export interface PaymentAuthorization {
  agreementVersion: number;
  requiredVersion: number;
  authorized: boolean;
  finalized: boolean;
  executionSuccessful: boolean;
  hasAppeal: boolean;
  humanReview: boolean;
  held: boolean;
}
export function requirePaymentAuthorization(a: PaymentAuthorization) {
  if (
    a.agreementVersion !== a.requiredVersion ||
    !a.authorized ||
    !a.finalized ||
    !a.executionSuccessful ||
    a.hasAppeal ||
    a.humanReview ||
    a.held
  )
    throw Error("Payment authorization requirements not met");
}
export interface EscrowAdapter {
  release(approval: {
    milestoneId: string;
    actorId: string;
    agreementVersion: number;
    assessmentId: string;
    paymentReference: string;
  }): Promise<{ transactionHash: string }>;
}
