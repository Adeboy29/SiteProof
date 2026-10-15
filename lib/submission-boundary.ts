export class GenlayerSubmissionError extends Error {
  constructor(
    public readonly phase: "preflight" | "broadcast",
    message: string,
  ) {
    super(message);
    this.name = "GenlayerSubmissionError";
  }
}
export async function executeSubmission<T>(
  prepare: () => Promise<T>,
  broadcast: (prepared: T) => Promise<unknown>,
): Promise<string> {
  let prepared: T;
  try {
    prepared = await prepare();
  } catch {
    throw new GenlayerSubmissionError(
      "preflight",
      "Configuration, input validation or fee estimation failed before broadcast.",
    );
  }
  try {
    const hash = await broadcast(prepared);
    if (typeof hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(hash))
      throw Error("Invalid transaction ID");
    return hash;
  } catch {
    throw new GenlayerSubmissionError(
      "broadcast",
      "Broadcast outcome is unknown. Reconcile the existing request before retrying.",
    );
  }
}
