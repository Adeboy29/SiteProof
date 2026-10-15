import { it, expect } from "vitest";
import { classifyTransaction } from "../lib/transaction-state";
it("keeps submitted and decided transactions pending", () => {
  expect(classifyTransaction("processing", false)).toBe("pending");
  expect(classifyTransaction("decided", true)).toBe("pending");
});
it("requires finalization and execution success", () => {
  expect(classifyTransaction("finalized", false)).toBe("rejected");
  expect(classifyTransaction("finalized", true)).toBe("finalized");
  expect(classifyTransaction("canceled", false)).toBe("rejected");
});
