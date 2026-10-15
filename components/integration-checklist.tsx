"use client";
import { useEffect, useState } from "react";
type State = {
  supabaseConfigured: boolean;
  serverCredentialsConfigured: boolean;
  genlayerMode: string;
  network: string;
  signerConfigured: boolean;
  contractConfigured: boolean;
  databaseVerified: boolean;
  contractVerified: boolean;
  liveVerified: boolean;
  issues: string[];
};
export function IntegrationChecklist() {
  const [state, setState] = useState<State | null>(null),
    [error, setError] = useState("");
  async function load() {
    try {
      const response = await fetch("/api/integration");
      if (!response.ok) throw Error();
      setState(await response.json());
      setError("");
    } catch {
      setError("Integration checks could not be loaded.");
    }
  }
  useEffect(() => {
    load();
  }, []);
  return (
    <section className="panel space-top">
      <div className="section-heading">
        <h2>Live integration readiness</h2>
        <button className="secondary" onClick={load}>
          Check connection
        </button>
      </div>
      {state ? (
        <>
          <span className="tag">
            {state.liveVerified
              ? "Backend and contract interface verified"
              : state.genlayerMode === "development"
                ? "Development mode · no live assessment requested"
                : "Live setup incomplete"}
          </span>
          <p>Network: {state.network}</p>
          <ul className="readiness-list">
            {[
              ["Supabase project configured", state.supabaseConfigured],
              [
                "Server credential configured",
                state.serverCredentialsConfigured,
              ],
              ["Database checked while signed in", state.databaseVerified],
              ["Test signer configured", state.signerConfigured],
              ["Deployed contract configured", state.contractConfigured],
              ["SiteProof contract interface checked", state.contractVerified],
            ].map(([label, ok]) => (
              <li key={String(label)}>
                <span>{ok ? "✓" : "○"}</span>
                {label}
              </li>
            ))}
          </ul>
          {state.issues.map((issue, i) => (
            <p key={i} role="status">
              {issue}
            </p>
          ))}
          <p className="muted">
            Configuration and interface checks do not prove an assessment
            executed. A real assessment must show its transaction hash,
            successful execution, finalization and matching manifest hash.
          </p>
        </>
      ) : (
        <p>{error || "Checking server configuration…"}</p>
      )}
    </section>
  );
}
