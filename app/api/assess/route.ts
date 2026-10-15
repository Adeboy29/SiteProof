import { NextRequest } from "next/server";
import {
  mkdir,
  readFile,
  writeFile,
  readdir,
  open,
  rename,
  unlink,
} from "node:fs/promises";
import { resolve, join } from "node:path";
import type { Hash } from "genlayer-js-stable/types";
import {
  assessmentInput,
  makeManifest,
  contentHash,
  verifySimpleReport,
  type SimpleManifest,
} from "../../../lib/simple-assessment";
import { simpleClient, simpleAddress } from "../../../lib/simple-client";
import { studioReceipt } from "../../../lib/studio-receipt";
export const runtime = "nodejs";
export const maxDuration = 60;
const directory = () =>
  resolve(process.env.SITEPROOF_DATA_DIR || "work/assessments");
type Job = {
  id: string;
  title: string;
  createdAt: string;
  contract: `0x${string}`;
  manifest: SimpleManifest;
  manifestHash: string;
  hash?: Hash;
  state: string;
  error?: string;
};
const file = (id: string) => join(directory(), id + ".json");
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
async function save(job: Job) {
  const temp = file(job.id) + ".tmp";
  await writeFile(temp, JSON.stringify(job));
  await rename(temp, file(job.id));
}
async function read(id: string): Promise<Job> {
  return JSON.parse(await readFile(file(id), "utf8"));
}
async function status(job: Job) {
  const base = {
    id: job.id,
    title: job.title,
    hash: job.hash,
    contract: job.contract,
    network: "studionet",
    manifestHash: job.manifestHash,
    createdAt: job.createdAt,
  };
  if (!job.hash) return { ...base, state: job.state, error: job.error };
  const client = simpleClient(),
    tx = await client.getTransaction({ hash: job.hash });
  if (tx.statusName === "CANCELED")
    return { ...base, state: "rejected", protocolStatus: tx.statusName };
  if (tx.statusName !== "FINALIZED")
    return { ...base, state: "pending", protocolStatus: tx.statusName };
  if (!studioReceipt(tx).successful)
    return {
      ...base,
      state: "rejected",
      protocolStatus: tx.statusName,
      error: "GenLayer finalized this transaction with an execution error.",
    };
  const [raw, hash] = await Promise.all([
    client.readContract({
      address: job.contract,
      functionName: "get_assessment",
      args: [job.id],
    }),
    client.readContract({
      address: job.contract,
      functionName: "get_manifest_hash",
      args: [job.id],
    }),
  ]);
  return {
    ...base,
    state: "finalized",
    protocolStatus: tx.statusName,
    report: verifySimpleReport(raw, job.manifest, hash),
  };
}
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    try {
      const contract = simpleAddress(),
        client = simpleClient(true);
      const owner = await client.readContract({
        address: contract,
        functionName: "get_owner",
        args: [],
      });
      if (String(owner).toLowerCase() !== client.account?.address.toLowerCase())
        throw Error("The configured signer does not own this contract.");
      return json({ ready: true, network: "studionet", contract });
    } catch (error) {
      return json({
        ready: false,
        network: "studionet",
        error:
          error instanceof Error && error.message.startsWith("Deploy")
            ? error.message
            : "The GenLayer connection is not ready. Check the server configuration and network.",
      });
    }
  }
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return json({ error: "Invalid request ID" }, 400);
  let job;
  try {
    job = await read(id);
  } catch {
    return json({ error: "Submission not found." }, 404);
  }
  try {
    return json(await status(job));
  } catch {
    return json(
      {
        id,
        hash: job.hash,
        state: "unresolved",
        error:
          "Network status is unavailable. Keep this request ID and check again; do not resubmit.",
      },
      503,
    );
  }
}
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  let sameOrigin = false;
  try {
    sameOrigin =
      !!origin &&
      new URL(origin).host === req.headers.get("host") &&
      ["http:", "https:"].includes(new URL(origin).protocol);
  } catch {
    /* Reject malformed origin. */
  }
  if (!sameOrigin)
    return json({ error: "Submit from the SiteProof page." }, 403);
  if (Number(req.headers.get("content-length") || 0) > 45000)
    return json({ error: "Submission too large" }, 413);
  let input;
  try {
    const body = await req.text();
    if (body.length > 45000)
      return json({ error: "Submission too large" }, 413);
    input = assessmentInput.parse(JSON.parse(body));
  } catch {
    return json(
      {
        error:
          "Enter a milestone, 1–12 criteria and evidence, then approve public submission.",
      },
      400,
    );
  }
  await mkdir(directory(), { recursive: true });
  try {
    const existing = await read(input.id);
    return json(await status(existing));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT")
      return json(
        { error: "Could not check the previous submission. Do not resend." },
        503,
      );
  }
  let contract;
  try {
    contract = simpleAddress();
    simpleClient(true);
  } catch {
    return json(
      {
        error: "GenLayer is not configured. Run npm run contract:deploy first.",
      },
      503,
    );
  }
  // File lock serializes the server signer and caps sponsored Studio usage across restarts.
  const lockPath = join(directory(), "signer.lock");
  let lock;
  try {
    lock = await open(lockPath, "wx");
  } catch {
    return json(
      {
        error:
          "Another submission is using the signer. Wait a moment and check your request ID before retrying.",
      },
      429,
    );
  }
  try {
    try {
      const existing = await read(input.id);
      return json(await status(existing));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const files = (await readdir(directory())).filter((f) =>
      f.endsWith(".json"),
    );
    const recent = await Promise.all(
      files.map(async (name) => {
        try {
          return JSON.parse(
            await readFile(join(directory(), name), "utf8"),
          ) as Job;
        } catch {
          return null;
        }
      }),
    );
    if (
      recent.filter((j) => j && Date.now() - Date.parse(j.createdAt) < 3600000)
        .length >= 10
    )
      return json(
        {
          error:
            "This Studio demo allows 10 submissions per hour. Please try later.",
        },
        429,
      );
    const manifest = makeManifest(input),
      job: Job = {
        id: input.id,
        title: input.title,
        createdAt: new Date().toISOString(),
        contract,
        manifest,
        manifestHash: contentHash(JSON.stringify(manifest)),
        state: "submitting",
      };
    await writeFile(file(job.id), JSON.stringify(job), { flag: "wx" });
    try {
      const hash: unknown = await simpleClient(true).writeContract({
        address: contract,
        functionName: "assess",
        args: [job.id, JSON.stringify(manifest)],
        value: 0n,
      });
      if (typeof hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(hash))
        throw Error("No transaction hash returned");
      job.hash = hash as Hash;
      job.state = "pending";
    } catch {
      job.state = "unresolved";
      job.error =
        "The network did not confirm submission. Do not resend this request: it may have been broadcast.";
    }
    await save(job);
    return json(
      {
        id: job.id,
        title: job.title,
        state: job.state,
        hash: job.hash,
        error: job.error,
        contract,
        network: "studionet",
        manifestHash: job.manifestHash,
        createdAt: job.createdAt,
      },
      202,
    );
  } catch {
    return json(
      {
        error:
          "Submission storage is unavailable. Check this request ID before trying again.",
      },
      503,
    );
  } finally {
    await lock.close();
    await unlink(lockPath).catch(() => {});
  }
}
