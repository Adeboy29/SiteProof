import {sqliteTable,text,index} from "drizzle-orm/sqlite-core";
export const assessmentJobs=sqliteTable("assessment_jobs",{
  id:text("id").primaryKey(),
  title:text("title").notNull(),
  createdAt:text("created_at").notNull(),
  contract:text("contract").notNull(),
  manifest:text("manifest").notNull(),
  manifestHash:text("manifest_hash").notNull(),
  state:text("state").notNull(),
  hash:text("hash"),
  error:text("error"),
  submissionToken:text("submission_token").notNull(),
},table=>[index("assessment_jobs_created_at_idx").on(table.createdAt)]);
export const signerLocks=sqliteTable("signer_locks",{
  name:text("name").primaryKey(),
  jobId:text("job_id").notNull(),
  submissionToken:text("submission_token").notNull(),
});
