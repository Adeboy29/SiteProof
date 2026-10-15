import {env} from "cloudflare:workers";
import type {Hash} from "genlayer-js-stable/types";
import {assessmentInput,makeManifest,contentHash,verifySimpleReport,type SimpleManifest} from "../../../lib/simple-assessment";
import {simpleClient,simpleAddress} from "../../../lib/simple-client";
import {studioReceipt} from "../../../lib/studio-receipt";
import {readJob,claimJob,finishSubmission,type StoredJob} from "../../../lib/assessment-store";
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
function database(){if(!env.DB)throw Error("Storage is not configured");return env.DB;}
async function status(job:StoredJob){
  const base={id:job.id,title:job.title,hash:job.hash,contract:job.contract,network:"studionet",manifestHash:job.manifest_hash,createdAt:job.created_at};
  if(!job.hash)return {...base,state:job.state,error:job.error};
  const client=simpleClient(),tx=await client.getTransaction({hash:job.hash as Hash});
  if(tx.statusName==="CANCELED")return {...base,state:"rejected",protocolStatus:tx.statusName};
  if(tx.statusName!=="FINALIZED")return {...base,state:"pending",protocolStatus:tx.statusName};
  if(!studioReceipt(tx).successful)return {...base,state:"rejected",protocolStatus:tx.statusName,error:"GenLayer finalized this transaction with an execution error."};
  const [raw,hash]=await Promise.all([
    client.readContract({address:job.contract as `0x${string}`,functionName:"get_assessment",args:[job.id]}),
    client.readContract({address:job.contract as `0x${string}`,functionName:"get_manifest_hash",args:[job.id]}),
  ]);
  return {...base,state:"finalized",protocolStatus:tx.statusName,report:verifySimpleReport(raw,JSON.parse(job.manifest) as SimpleManifest,hash)};
}
export async function GET(req:Request){
  const id=new URL(req.url).searchParams.get("id");
  if(!id){try{
    await database().prepare("SELECT id FROM assessment_jobs LIMIT 1").first();
    const contract=simpleAddress(),client=simpleClient(true);
    const owner=await client.readContract({address:contract,functionName:"get_owner",args:[]});
    if(String(owner).toLowerCase()!==client.account?.address.toLowerCase())throw Error("Signer mismatch");
    return json({ready:true,network:"studionet",contract});
  }catch{return json({ready:false,network:"studionet",error:"The GenLayer connection is unavailable. Check the connection again shortly."});}}
  if(!/^[0-9a-f-]{36}$/i.test(id))return json({error:"Invalid request ID"},400);
  let job:StoredJob|null=null;
  try{job=await readJob(database(),id);if(!job)return json({error:"Submission not found."},404);return json(await status(job));}
  catch{return json({id,hash:job?.hash,state:"unresolved",error:"Network status is unavailable. Your request is saved; check again without resubmitting."},503);}
}
export async function POST(req:Request){
  const origin=req.headers.get("origin"),expected=env.SITEPROOF_PUBLIC_ORIGIN||new URL(req.url).origin;
  if(!origin||origin!==expected)return json({error:"Submit from the SiteProof page."},403);
  if(Number(req.headers.get("content-length")||0)>45000)return json({error:"Submission too large"},413);
  let input;
  try{const body=await req.text();if(body.length>45000)return json({error:"Submission too large"},413);input=assessmentInput.parse(JSON.parse(body));}
  catch{return json({error:"Enter a milestone, 1–12 criteria and evidence, then approve public submission."},400);}
  let job:StoredJob|null=null;
  try{
    const db=database(),existing=await readJob(db,input.id);
    if(existing)return json(await status(existing));
    const contract=simpleAddress();simpleClient(true);
    const manifest=JSON.stringify(makeManifest(input));
    job={id:input.id,title:input.title,created_at:new Date().toISOString(),contract,manifest,manifest_hash:contentHash(manifest),state:"submitting",hash:null,error:null,submission_token:crypto.randomUUID()};
    const claim=await claimJob(db,job);
    if(!claim.claimed){if(claim.job)return json(await status(claim.job));return json({error:"The signer is busy or the 10 submissions per hour limit has been reached. Please try later."},429);}
    try{
      const hash:unknown=await simpleClient(true).writeContract({address:contract,functionName:"assess",args:[job.id,manifest],value:0n});
      if(typeof hash!=="string"||!/^0x[0-9a-fA-F]{64}$/.test(hash))throw Error("No transaction hash returned");
      job.hash=hash;job.state="pending";
    }catch{job.state="unresolved";job.error="The network did not confirm submission. Do not resend this request: it may have been broadcast.";}
    await finishSubmission(db,job);
    return json({id:job.id,title:job.title,state:job.state,hash:job.hash,error:job.error,contract,network:"studionet",manifestHash:job.manifest_hash,createdAt:job.created_at},202);
  }catch{return json({id:input.id,hash:job?.hash,error:"Could not confirm submission. Check this request ID before trying again."},503);}
}
