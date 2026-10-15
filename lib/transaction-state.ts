export function classifyTransaction(lifecycle: string, successful: boolean) {
  if (lifecycle === "finalized") return successful ? "finalized" : "rejected";
  if (lifecycle === "canceled") return "rejected";
  return "pending";
}
