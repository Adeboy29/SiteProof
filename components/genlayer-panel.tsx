"use client";
import { useEffect, useState, useRef } from "react";
type Row = {
  id: string;
  mode: string;
  status: string;
  criteria_version: number;
};
export function GenLayerPanel({
  milestoneId,
  configured,
  refreshToken = "",
  onFinalized,
}: {
  milestoneId: string;
  configured: boolean;
  refreshToken?: string;
  onFinalized?: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]),
    [details, setDetails] = useState<Record<string, unknown>>({}),
    [error, setError] = useState("");
  const finalizedCallback = useRef(onFinalized);
  useEffect(() => {
    finalizedCallback.current = onFinalized;
  }, [onFinalized]);
  async function load() {
    if (!configured) return;
    const r = await fetch("/api/transactions?milestone=" + milestoneId);
    if (r.ok) setRows((await r.json()).assessments);
  }
  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    async function poll() {
      try {
        const response = await fetch(
          "/api/transactions?milestone=" + milestoneId,
        );
        if (!response.ok) throw Error("Could not load assessment requests");
        const result = await response.json();
        if (cancelled) return;
        setRows(result.assessments);
        for (const assessment of result.assessments
          .filter(
            (a: Row) =>
              a.mode === "genlayer" &&
              [
                "requested",
                "submitted",
                "pending",
                "submission_unknown",
              ].includes(a.status),
          )
          .slice(0, 3)) {
          const status = await fetch(
              "/api/transactions?assessment=" + assessment.id,
            ),
            detail = await status.json();
          if (cancelled) return;
          if (status.ok) {
            setDetails(detail);
            if (detail.lifecycle?.state === "finalized")
              finalizedCallback.current?.();
          } else setError(detail.error || "Transaction remains pending.");
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Status check failed");
      }
    }
    poll();
    const timer = setInterval(poll, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [milestoneId, configured, refreshToken]);
  return (
    <div className="panel space-top">
      <h3>GenLayer status</h3>
      <p className="muted">
        {configured
          ? "Actual request records and protocol receipts."
          : "Offchain development. No blockchain transaction exists."}
      </p>
      {rows.map((a) => (
        <div className="report" key={a.id}>
          <span className="tag">
            {a.mode} · {a.status}
          </span>
          <p>Criteria version {a.criteria_version}</p>
          {a.mode === "genlayer" && (
            <button
              className="secondary"
              onClick={async () => {
                setError("");
                const r = await fetch("/api/transactions?assessment=" + a.id);
                const result = await r.json();
                if (!r.ok) setError(result.error);
                else {
                  setDetails(result);
                  load();
                }
              }}
            >
              Refresh actual transaction
            </button>
          )}
        </div>
      ))}
      {Object.keys(details).length > 0 && (
        <dl className="transaction-details">
          {Object.entries(details).map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>
                {typeof value === "object"
                  ? JSON.stringify(value)
                  : String(value)}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {error && <p role="alert">{error}</p>}
      <p className="muted">
        Submission is not finality. Validator acceptance does not establish
        physical truth.
      </p>
    </div>
  );
}
