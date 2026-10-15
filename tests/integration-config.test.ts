import { it, expect } from "vitest";
import { integrationState } from "../lib/integration-state";
import { feeOptions, feeProfileSchema } from "../lib/fee-profile";
it("does not label incomplete or development configuration live", () => {
  expect(integrationState({}).readyForLiveRequests).toBe(false);
  expect(
    integrationState({ GENLAYER_MODE: "genlayer" }).readyForLiveRequests,
  ).toBe(false);
});
it("requires a measured fee configuration on public testnet", () => {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public",
    SUPABASE_SERVICE_ROLE_KEY: "server",
    GENLAYER_MODE: "genlayer",
    GENLAYER_NETWORK: "bradbury",
    GENLAYER_PRIVATE_KEY: "0x" + "1".repeat(64),
    GENLAYER_CONTRACT_ADDRESS: "0x" + "2".repeat(40),
  };
  expect(integrationState(env).readyForLiveRequests).toBe(false);
  expect(
    integrationState({ ...env, GENLAYER_FEE_PROFILE_PATH: "fee-profile.json" })
      .readyForLiveRequests,
  ).toBe(true);
});
it("converts measured profile quantities without precision loss", () => {
  const opts = feeOptions({
    leaderTimeunitsAllocation: "100",
    validatorTimeunitsAllocation: "200",
    executionBudgetPerRound: "9007199254740993",
    rotationsPerRound: "1",
  });
  expect(opts.executionBudgetPerRound).toBe(9007199254740993n);
  expect(opts.rotations).toEqual([1n, 1n]);
  expect(() => feeOptions({ leaderTimeunitsAllocation: "-1" })).toThrow();
  expect(feeProfileSchema.safeParse({ version: 1, methods: {} }).success).toBe(
    false,
  );
});
