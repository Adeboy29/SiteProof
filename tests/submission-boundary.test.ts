import { it, expect, vi } from "vitest";
import { executeSubmission } from "../lib/submission-boundary";
it("does not broadcast when preflight fails", async () => {
  const send = vi.fn();
  await expect(
    executeSubmission(async () => {
      throw Error("RPC unavailable");
    }, send),
  ).rejects.toMatchObject({ phase: "preflight" });
  expect(send).not.toHaveBeenCalled();
});
it("does not retry an uncertain broadcast", async () => {
  const send = vi.fn(async () => {
    throw Error("Connection lost after send");
  });
  await expect(
    executeSubmission(async () => ({ fees: 1 }), send),
  ).rejects.toMatchObject({ phase: "broadcast" });
  expect(send).toHaveBeenCalledTimes(1);
});
it("rejects missing transaction identifiers without inventing success", async () => {
  await expect(
    executeSubmission(
      async () => 1,
      async () => ({ submitted: true }),
    ),
  ).rejects.toMatchObject({ phase: "broadcast" });
  const hash = "0x" + "a".repeat(64);
  expect(
    await executeSubmission(
      async () => 1,
      async () => hash,
    ),
  ).toBe(hash);
});
