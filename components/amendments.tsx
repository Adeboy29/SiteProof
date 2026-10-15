"use client";
import { useEffect, useState } from "react";
export function Amendments({ milestoneId }: { milestoneId: string }) {
  const [items, setItems] = useState<
      {
        id: string;
        reason: string;
        status: string;
        base_version: number;
        criteria: string[];
      }[]
    >([]),
    [message, setMessage] = useState("");
  async function load() {
    const r = await fetch("/api/amendments?milestone=" + milestoneId);
    if (r.ok) setItems(await r.json());
  }
  useEffect(() => {
    load();
  }, [milestoneId]);
  return (
    <details className="amendments">
      <summary>Propose a traceable criteria amendment</summary>
      <p className="muted">
        The owner and every assigned contractor must consent. Original
        submissions remain unchanged.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const r = await fetch("/api/amendments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              operation: "propose",
              milestone_id: milestoneId,
              criteria: f.get("criteria"),
              reason: f.get("reason"),
            }),
          });
          setMessage(
            r.ok
              ? "Proposal recorded. Waiting for required consents."
              : "Proposal not permitted. Check role and pending amendments.",
          );
          load();
        }}
      >
        <label>
          New criteria (one per line)
          <textarea name="criteria" required />
        </label>
        <label>
          Reason
          <textarea name="reason" minLength={10} required />
        </label>
        <button className="secondary">Propose amendment</button>
      </form>
      {items.map((a) => (
        <div className="report" key={a.id}>
          <b>{a.reason}</b>
          <p>
            Version {a.base_version} · {a.status}
          </p>
          {a.criteria.map((c, i) => (
            <p key={i}>{c}</p>
          ))}
          {a.status === "pending" && (
            <button
              className="secondary"
              onClick={async () => {
                const r = await fetch("/api/amendments", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    operation: "agree",
                    amendment_id: a.id,
                  }),
                });
                setMessage(
                  r.ok
                    ? "Consent recorded. Refresh the workspace when all parties agree."
                    : "Consent not permitted.",
                );
                load();
              }}
            >
              Agree to this amendment
            </button>
          )}
        </div>
      ))}
      <p role="status">{message}</p>
    </details>
  );
}
