"use client";
import { useState } from "react";
type Draft = {
  submission_id: string;
  criteria: string[];
  criteria_version: number;
  prepared: unknown;
  evidence: { id: string; hash: string; description: string }[];
  inspections: { id: string; notes: string }[];
};
export function Preparation({ milestoneId }: { milestoneId: string }) {
  const [draft, setDraft] = useState<Draft | null>(null),
    [content, setContent] = useState(""),
    [message, setMessage] = useState("");
  return (
    <details className="amendments">
      <summary
        onClick={async () => {
          const r = await fetch("/api/preparation?milestone=" + milestoneId),
            d = await r.json();
          if (!r.ok) {
            setMessage(d.error);
            return;
          }
          setDraft(d);
          setContent(
            JSON.stringify(
              {
                evidence: d.evidence.map(
                  (e: { id: string; description: string }) => ({
                    id: e.id,
                    description: e.description,
                  }),
                ),
                inspections: d.inspections,
              },
              null,
              2,
            ),
          );
        }}
      >
        Prepare evidence for GenLayer
      </summary>
      <p>
        Review the agreed criteria and write redacted summaries. The manifest
        will be visible to the blockchain network. Never include personal
        information or confidential commercial details. Original documents stay
        private.
      </p>
      {draft && (
        <>
          <b>Criteria version {draft.criteria_version}</b>
          {draft.criteria.map((c, i) => (
            <p key={i}>{c}</p>
          ))}
          {draft.prepared ? (
            <p className="tag">
              Immutable manifest already approved for this submission.
            </p>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const summaries = JSON.parse(content),
                    r = await fetch("/api/preparation", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        ...summaries,
                        submission_id: draft.submission_id,
                        consent: true,
                      }),
                    });
                  setMessage(
                    r.ok
                      ? "Manifest approved. You can now request a GenLayer assessment."
                      : "Approval rejected. Check role, references and summaries.",
                  );
                } catch {
                  setMessage(
                    "Use valid JSON with evidence and inspections arrays.",
                  );
                }
              }}
            >
              <label>
                Redacted summaries · JSON
                <textarea
                  rows={12}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                />
              </label>
              <label className="consent">
                <input type="checkbox" required />I reviewed all criteria and
                summaries and approve their public blockchain disclosure.
              </label>
              <button className="secondary">Approve immutable manifest</button>
            </form>
          )}
        </>
      )}
      <p role="status">{message}</p>
    </details>
  );
}
