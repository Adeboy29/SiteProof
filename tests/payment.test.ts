import { it, expect } from "vitest";
import { requirePaymentAuthorization } from "../lib/payment";
const valid = {
  agreementVersion: 1,
  requiredVersion: 1,
  authorized: true,
  finalized: true,
  executionSuccessful: true,
  hasAppeal: false,
  humanReview: false,
  held: false,
};
it("blocks payments on pending decisions, appeals, holds and unauthorized requests", () => {
  for (const changes of [
    { finalized: false },
    { hasAppeal: true },
    { humanReview: true },
    { held: true },
    { authorized: false },
    { agreementVersion: 2 },
    { executionSuccessful: false },
  ])
    expect(() =>
      requirePaymentAuthorization({ ...valid, ...changes }),
    ).toThrow();
  expect(() => requirePaymentAuthorization(valid)).not.toThrow();
});
