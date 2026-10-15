import { z } from "zod";
// Studio's hosted RPC includes snake_case consensus receipts, unlike public-chain SDK receipts.
const receiptSchema = z.object({
  statusName: z.string().optional(),
  txExecutionResultName: z.string().optional(),
  result_name: z.string().optional(),
  consensus_data: z
    .object({
      leader_receipt: z
        .array(z.object({ execution_result: z.string() }))
        .optional(),
    })
    .optional(),
});
export function studioReceipt(value: unknown) {
  const tx = receiptSchema.parse(value);
  const execution =
    tx.txExecutionResultName ||
    tx.consensus_data?.leader_receipt?.at(-1)?.execution_result;
  return {
    status: tx.statusName || "UNKNOWN",
    successful:
      tx.statusName === "FINALIZED" &&
      (execution === "SUCCESS" || execution === "FINISHED_WITH_RETURN") &&
      (!tx.result_name || tx.result_name === "MAJORITY_AGREE"),
  };
}
