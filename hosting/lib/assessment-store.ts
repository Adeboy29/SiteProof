export type StoredJob={id:string;title:string;created_at:string;contract:string;manifest:string;manifest_hash:string;state:string;hash:string|null;error:string|null;submission_token:string};
export async function readJob(db:D1Database,id:string){
  return db.prepare("SELECT * FROM assessment_jobs WHERE id = ?").bind(id).first<StoredJob>();
}
export async function claimJob(db:D1Database,job:StoredJob){
  // D1 batch is transactional. The conditional insert, quota and signer reservation
  // therefore have one winner across concurrent requests and Worker instances.
  const results=await db.batch([
    db.prepare(`INSERT INTO assessment_jobs (id,title,created_at,contract,manifest,manifest_hash,state,hash,error,submission_token)
      SELECT ?,?,?,?,?,?,? ,NULL,NULL,?
      WHERE NOT EXISTS (SELECT 1 FROM signer_locks WHERE name='genlayer')
      AND (SELECT count(*) FROM assessment_jobs WHERE created_at > ?) < 10
      ON CONFLICT(id) DO NOTHING`).bind(job.id,job.title,job.created_at,job.contract,job.manifest,job.manifest_hash,job.state,job.submission_token,new Date(Date.parse(job.created_at)-3600000).toISOString()),
    db.prepare(`INSERT OR IGNORE INTO signer_locks(name,job_id,submission_token)
      SELECT 'genlayer',id,submission_token FROM assessment_jobs WHERE id=? AND submission_token=?`).bind(job.id,job.submission_token),
  ]);
  if(results[0].meta.changes===1&&results[1].meta.changes===1)return {claimed:true,job};
  return {claimed:false,job:await readJob(db,job.id)};
}
export async function finishSubmission(db:D1Database,job:StoredJob){
  // Persist the hash (or ambiguity) before releasing the signer. If saving fails,
  // leave the lock in place so a runtime interruption cannot cause blind retries.
  await db.batch([
    db.prepare("UPDATE assessment_jobs SET state=?,hash=?,error=? WHERE id=? AND submission_token=?").bind(job.state,job.hash,job.error,job.id,job.submission_token),
    db.prepare("DELETE FROM signer_locks WHERE name='genlayer' AND job_id=? AND submission_token=?").bind(job.id,job.submission_token),
  ]);
}
