import { createClient } from "@supabase/supabase-js";
const {
  NEXT_PUBLIC_SUPABASE_URL: url,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
  SEED_EMAIL: email,
  SEED_PASSWORD: password,
} = process.env;
if (!url || !key || !email || !password)
  throw Error(
    "Set Supabase URL, publishable key, SEED_EMAIL and SEED_PASSWORD locally.",
  );
const db = createClient(url, key, { auth: { persistSession: false } });
const { error } = await db.auth.signInWithPassword({ email, password });
if (error) throw error;
const { data: pid, error: e } = await db.rpc("workspace_action", {
  action: "project",
  payload: {
    name: "DEMO · Lekki Residence",
    reference: "DEMO-2026-001",
    address: "Lekki Phase 1, Lagos",
    description: "Demonstration records only. No onchain transactions.",
  },
});
if (e) throw e;
for (const title of [
  "Site preparation and foundation",
  "Reinforcement and formwork",
  "Concrete casting",
]) {
  const { error } = await db.rpc("workspace_action", {
    action: "milestone",
    payload: {
      project_id: pid,
      title,
      criteria:
        "Dimensions verified against agreed drawings by an attributed inspector.\nSigned material test results attached.\nOutstanding defects documented.",
      due_date: "2026-11-30",
      value: 2400000,
      payment_conditions:
        "Separate client approval after an attributed inspection.",
    },
  });
  if (error) throw error;
}
console.log(
  "Created labelled demo project and 3 draft milestones. No assessments or transactions were invented.",
);
