import {env} from "cloudflare:workers";
import {createAccount,createClient} from "genlayer-js-stable";
import {studionet} from "genlayer-js-stable/chains";
export function simpleClient(signed=false){
  if((env.GENLAYER_NETWORK||"studionet")!=="studionet")throw Error("Unsupported network");
  const key=env.GENLAYER_PRIVATE_KEY;
  if(signed&&!/^0x[0-9a-fA-F]{64}$/.test(key||""))throw Error("Studio signer is not configured");
  return createClient({chain:studionet,...(signed?{account:createAccount(key as `0x${string}`)}:{})});
}
export function simpleAddress(){
  const address=env.GENLAYER_CONTRACT_ADDRESS;
  if(!/^0x[0-9a-fA-F]{40}$/.test(address||""))throw Error("Contract is not configured");
  return address as `0x${string}`;
}
