import { existsSync } from "node:fs";
import { simpleClient, simpleAddress } from "../lib/simple-client.ts";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
try {
  const address = simpleAddress(),
    client = simpleClient(true);
  const owner = await client.readContract({
    address,
    functionName: "get_owner",
    args: [],
  });
  if (String(owner).toLowerCase() !== client.account.address.toLowerCase())
    throw Error("Signer does not own the contract.");
  console.log(
    "PASS: stable Studio connection, deployed contract and server signer.",
  );
  console.log("Contract:", address);
  console.log("Run npm run dev, then open http://127.0.0.1:3000.");
} catch {
  console.log(
    "Connection not ready. Run npm run contract:deploy to configure a dedicated Studio signer and deploy.",
  );
  process.exitCode = 2;
}
