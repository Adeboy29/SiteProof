import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { mkdir, mkdtemp, readdir, unlink, rmdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { NextRequest } from "next/server";
const mock = vi.hoisted(() => ({
  writeContract: vi.fn(),
  getTransaction: vi.fn(),
  readContract: vi.fn(),
  account: { address: "0x1111111111111111111111111111111111111111" },
}));
vi.mock("../lib/simple-client", () => ({
  simpleClient: () => mock,
  simpleAddress: () => "0x2222222222222222222222222222222222222222",
}));
import { POST } from "../app/api/assess/route";
const payload = {
  id: "816739af-7907-4c94-87e8-8a64535f040c",
  title: "Concrete test",
  criteria: ["Strength must reach 25 MPa."],
  evidence: "Report says 22 MPa at 28 days.",
  publicConsent: true,
};
function request(body: unknown = payload, origin = "http://localhost:3000") {
  return new NextRequest("http://localhost:3000/api/assess", {
    method: "POST",
    headers: {
      origin,
      host: "localhost:3000",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
let directory: string;
beforeEach(async () => {
  vi.clearAllMocks();
  mock.writeContract.mockResolvedValue("0x" + "a".repeat(64));
  mock.getTransaction.mockResolvedValue({ statusName: "PROPOSING" });
  await mkdir(resolve("work"), { recursive: true });
  directory = await mkdtemp(resolve("work/simple-api-test-"));
  vi.stubEnv("SITEPROOF_DATA_DIR", directory);
});
afterEach(async () => {
  for (const name of await readdir(directory))
    await unlink(join(directory, name));
  await rmdir(directory);
  vi.unstubAllEnvs();
});
describe("simple API submission boundary", () => {
  it("rejects cross-origin execution and missing public consent", async () => {
    expect(
      (await POST(request(payload, "https://untrusted.example"))).status,
    ).toBe(403);
    expect(
      (await POST(request({ ...payload, publicConsent: false }))).status,
    ).toBe(400);
    expect(mock.writeContract).not.toHaveBeenCalled();
  });
  it("persists a real hash and never broadcasts the same request twice", async () => {
    const first = await POST(request());
    expect(first.status).toBe(202);
    expect((await first.json()).hash).toBe("0x" + "a".repeat(64));
    const again = await POST(request());
    expect((await again.json()).state).toBe("pending");
    expect(mock.writeContract).toHaveBeenCalledTimes(1);
  });
  it("keeps ambiguous broadcasts unresolved rather than retrying", async () => {
    mock.writeContract.mockRejectedValueOnce(
      Error("Connection lost after sending"),
    );
    const first = await POST(request());
    expect((await first.json()).state).toBe("unresolved");
    const second = await POST(request());
    expect((await second.json()).state).toBe("unresolved");
    expect(mock.writeContract).toHaveBeenCalledTimes(1);
  });
});
