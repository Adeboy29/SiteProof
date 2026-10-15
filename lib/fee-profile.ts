import { z } from "zod";
import type { FeeEstimateOptions } from "genlayer-js/types";
const quantity = z.string().regex(/^\d{1,30}$/);
export const feeEntrySchema = z.object({
  leaderTimeunitsAllocation: quantity,
  validatorTimeunitsAllocation: quantity,
  executionBudgetPerRound: quantity,
  totalMessageFees: quantity.optional(),
  rotationsPerRound: z
    .string()
    .regex(/^\d{1,2}$/)
    .optional(),
});
export const feeProfileSchema = z.object({
  version: z.literal(1),
  network: z.string().min(1),
  measuredAt: z.string().datetime(),
  deploy: feeEntrySchema.optional(),
  methods: z.record(z.string(), feeEntrySchema),
});
export function feeOptions(
  entry: unknown,
  appealRounds = 1,
): FeeEstimateOptions {
  if (!Number.isInteger(appealRounds) || appealRounds < 0 || appealRounds > 5)
    throw Error("Invalid appeal posture");
  const parsed = feeEntrySchema.parse(entry),
    rotations = BigInt(parsed.rotationsPerRound || "0");
  return {
    leaderTimeunitsAllocation: BigInt(parsed.leaderTimeunitsAllocation),
    validatorTimeunitsAllocation: BigInt(parsed.validatorTimeunitsAllocation),
    executionBudgetPerRound: BigInt(parsed.executionBudgetPerRound),
    totalMessageFees: BigInt(parsed.totalMessageFees || "0"),
    appealRounds: BigInt(appealRounds),
    rotations: Array.from({ length: appealRounds + 1 }, () => rotations),
  };
}
