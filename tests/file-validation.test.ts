import { it, expect } from "vitest";
import { validateBytes } from "../lib/file-validation";
it("rejects MIME spoofing", () => {
  expect(() =>
    validateBytes("image/png", Buffer.from("<script>alert(1)</script>")),
  ).toThrow();
  expect(() =>
    validateBytes("application/pdf", Buffer.from("not a PDF")),
  ).toThrow();
});
it("accepts matching signatures and rejects null-containing text", () => {
  expect(() =>
    validateBytes("application/pdf", Buffer.from("%PDF-1.7\n")),
  ).not.toThrow();
  expect(() => validateBytes("text/plain", new Uint8Array([0, 1]))).toThrow();
});
