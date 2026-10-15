"use client";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  HardHat,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import type { Report } from "../lib/domain";
import "./simple.css";
import Link from "next/link";
type Connection = { ready: boolean; contract?: string; error?: string };
type Assessment = {
  id: string;
  title?: string;
  state: string;
  hash?: string;
  contract?: string;
  manifestHash?: string;
  protocolStatus?: string;
  report?: Report;
  error?: string;
};
const storageKey = "siteproof-simple-request";
export default function SiteProof() {
  const [title, setTitle] = useState("");
  const [criteria, setCriteria] = useState("");
  const [evidence, setEvidence] = useState("");
  const [inspector, setInspector] = useState("");
  const [inspection, setInspection] = useState("");
  const [consent, setConsent] = useState(false);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [job, setJob] = useState<Assessment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const connect = useCallback(async () => {
    try {
      const r = await fetch("/api/assess", { cache: "no-store" });
      setConnection(await r.json());
    } catch {
      setConnection({
        ready: false,
        error: "Cannot reach the server. Check the connection again.",
      });
    }
  }, []);
  const refresh = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/assess?id=${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      const data = await response.json() as Assessment & {error?:string};
      if (response.status === 404) {
        setError(
          "This request was not received by the server. You can start a new assessment.",
        );
        setJob(null);
        localStorage.removeItem(storageKey);
        return;
      }
      if (!response.ok) {
        setError(data.error || "Status unavailable. Check again shortly.");
        return;
      }
      setJob(data);
      setError("");
    } catch {
      setError(
        "Status unavailable. Your request is saved; check again shortly.",
      );
    }
  }, []);
  useEffect(() => {
    void connect();
    Promise.resolve().then(() => {
      try {
        const id = localStorage.getItem(storageKey);
        if (id) {
          setJob({ id, state: "pending" });
          void refresh(id);
        }
      } catch {
        /* Storage may be disabled. */
      }
    });
  }, [connect, refresh]);
  useEffect(() => {
    if (!job || ["submitting", "finalized", "rejected"].includes(job.state))
      return;
    const timer = setInterval(() => void refresh(job.id), 10000);
    return () => clearInterval(timer);
  }, [job, refresh]);
  function sample() {
    setTitle("Foundation concrete — Block A");
    setCriteria(
      "Concrete must reach a minimum compressive strength of 25 MPa at 28 days.\nThe test report must identify Block A foundation samples.",
    );
    setEvidence(
      "SYNTHETIC HACKATHON EXAMPLE. Lab report LAB-014 records 22 MPa at 28 days for sample BA-F01, identified as Block A foundation. A contractor email claims 27 MPa but provides no sample reference or signed test report.",
    );
    setInspector("Demo inspector (synthetic)");
    setInspection(
      "SYNTHETIC NOTES: I checked the submitted report and found BA-F01 listed as Block A foundation. The recorded strength is 22 MPa. The contractor's 27 MPa claim cannot be tied to this foundation sample. An independent engineering review is required.",
    );
    setConsent(false);
    setError("");
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || job) return;
    const id = crypto.randomUUID();
    try {
      localStorage.setItem(storageKey, id);
    } catch {
      setError(
        "Enable browser storage so your transaction can be recovered after a refresh.",
      );
      return;
    }
    setBusy(true);
    setError("");
    setJob({ id, title, state: "submitting" });
    try {
      const response = await fetch("/api/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          title,
          criteria: criteria
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          evidence,
          inspector,
          inspection,
          publicConsent: consent,
        }),
      });
      const data = await response.json() as Assessment & {error?:string};
      if (!response.ok) {
        setError(data.error || "Submission unavailable.");
        await refresh(id);
      } else setJob(data);
    } catch {
      setError(
        "The connection stopped before submission was confirmed. Check status before starting another assessment.",
      );
      setJob({ id, title, state: "unresolved" });
    } finally {
      setBusy(false);
    }
  }
  function reset() {
    localStorage.removeItem(storageKey);
    setJob(null);
    setError("");
    setConsent(false);
  }
  function download() {
    if (!job?.report) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(job, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `SiteProof-${job.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  const pending = !!job && !["finalized", "rejected"].includes(job.state);
  return (
    <div className="simple-site">
      <div className="simple-nav">
        <Link className="simple-logo" href="/">
          <span>
            <HardHat size={23} />
          </span>
          SiteProof<span className="simple-beta">BETA</span>
        </Link>
        <a
          className="simple-network"
          href="https://studio.genlayer.com"
          target="_blank"
          rel="noreferrer"
        >
          <i className={connection?.ready ? "connected" : ""} />
          {connection?.ready ? "GenLayer Studio connected" : "GenLayer Studio"}
          <ArrowUpRight size={14} />
        </a>
      </div>
      <div className="simple-content">
        <div className="simple-intro">
          <div className="simple-eyebrow">
            <span /> CONSTRUCTION, VERIFIED WITH GENLAYER
          </div>
          <h1>
            Proof before
            <br />
            <em>the next milestone.</em>
          </h1>
          <p>
            Turn construction evidence into a clear, traceable assessment.
            <br className="desktop-break" /> Submit your milestone. Let an
            Intelligent Contract review it.
          </p>
        </div>
        <div className="simple-steps">
          <span>
            <b>01</b> Define the milestone
          </span>
          <ArrowRight size={16} />
          <span>
            <b>02</b> Submit the evidence
          </span>
          <ArrowRight size={16} />
          <span>
            <b>03</b> Get the assessment
          </span>
        </div>
        <div className="simple-grid">
          <section className="simple-card simple-form-card">
            <div className="simple-card-heading">
              <div>
                <span className="simple-overline">NEW ASSESSMENT</span>
                <h2>What’s been built?</h2>
              </div>
              <button
                className="simple-text-button"
                type="button"
                onClick={sample}
                disabled={!!job}
              >
                <Sparkles size={15} /> Load example
              </button>
            </div>
            <form onSubmit={submit}>
              <fieldset disabled={busy || !!job}>
                <label htmlFor="milestone">Milestone name</label>
                <input
                  id="milestone"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Foundation concrete — Block A"
                  minLength={3}
                  maxLength={200}
                  required
                />
                <label htmlFor="criteria">
                  Acceptance criteria{" "}
                  <span>One requirement per line · up to 12</span>
                </label>
                <textarea
                  id="criteria"
                  rows={3}
                  value={criteria}
                  onChange={(e) => setCriteria(e.target.value)}
                  placeholder={
                    "Concrete strength of at least 25 MPa at 28 days.\nLab report identifies the foundation samples."
                  }
                  maxLength={12000}
                  required
                />
                <label htmlFor="evidence">
                  Evidence{" "}
                  <span>Paste the report, site notes or relevant excerpts</span>
                </label>
                <textarea
                  id="evidence"
                  rows={5}
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  placeholder="Include measurements, dates, sample references and the source of each claim…"
                  minLength={10}
                  maxLength={12000}
                  required
                />
                <details className="simple-inspection">
                  <summary>
                    <ClipboardCheck size={17} /> Add inspector’s findings{" "}
                    <span>Optional</span>
                  </summary>
                  <label htmlFor="inspector">Inspector name or reference</label>
                  <input
                    id="inspector"
                    value={inspector}
                    onChange={(e) => setInspector(e.target.value)}
                    maxLength={120}
                    placeholder="Who provided the inspection?"
                    required={!!inspection}
                  />
                  <label htmlFor="inspection">Inspection notes</label>
                  <textarea
                    id="inspection"
                    value={inspection}
                    onChange={(e) => setInspection(e.target.value)}
                    rows={3}
                    maxLength={8000}
                    placeholder="Observations and supporting references. Identity is user attributed."
                  />
                </details>
                <label className="simple-consent">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    required
                  />
                  <span>
                    I agree to send this text to the public GenLayer Studio
                    network. I have removed confidential information.
                  </span>
                </label>
                <button
                  className="simple-primary"
                  type="submit"
                  disabled={!connection?.ready || busy || !!job}
                >
                  {busy ? (
                    <LoaderCircle className="simple-spin" size={18} />
                  ) : (
                    <ShieldCheck size={18} />
                  )}
                  Run Intelligent Contract
                  <ArrowRight size={18} />
                </button>
              </fieldset>
            </form>
            <div className="simple-form-foot">
              <ShieldCheck size={14} /> Evidence is hashed. Reports are read
              back from the contract.
            </div>
            {connection && !connection.ready && (
              <div className="simple-notice">
                <p>{connection.error}</p>
                <button onClick={() => void connect()}>Check connection</button>
              </div>
            )}
            {error && (
              <p className="simple-error" role="alert">
                {error}
              </p>
            )}
          </section>
          <div className="simple-right">
            <section className="simple-card simple-result" aria-live="polite">
              <div className="simple-card-heading">
                <div>
                  <span className="simple-overline">CONTRACT RESULT</span>
                  <h2>Your assessment</h2>
                </div>
                <span
                  className={`simple-status ${job?.state === "finalized" ? "done" : ""}`}
                >
                  {job?.state === "finalized"
                    ? "Finalized"
                    : job?.state === "rejected"
                      ? "Rejected"
                      : pending
                        ? "In progress"
                        : "Awaiting evidence"}
                </span>
              </div>
              {!job ? (
                <div className="simple-empty">
                  <div className="simple-document">
                    <FileText size={38} strokeWidth={1.3} />
                    <span>
                      <Check size={14} />
                    </span>
                  </div>
                  <h3>A decision with a paper trail.</h3>
                  <p>
                    Your contract assessment will appear here,
                    <br />
                    with findings for every criterion and a<br />
                    verifiable transaction record.
                  </p>
                  <div className="simple-empty-list">
                    <span>
                      <CheckCircle2 size={15} /> Criterion-by-criterion findings
                    </span>
                    <span>
                      <CheckCircle2 size={15} /> Missing evidence & next steps
                    </span>
                    <span>
                      <CheckCircle2 size={15} /> On-chain evidence fingerprint
                    </span>
                  </div>
                </div>
              ) : (
                <div className="simple-result-body">
                  {job.report ? (
                    <>
                      <div
                        className={`simple-outcome ${job.report.outcome === "Requirements satisfied" ? "satisfied" : "review"}`}
                      >
                        <ShieldCheck size={24} />
                        <div>
                          <span>GENLAYER ASSESSMENT</span>
                          <h3>{job.report.outcome}</h3>
                        </div>
                      </div>
                      <p>{job.report.summary}</p>
                      <div className="simple-findings">
                        {job.report.findings.map((f, i) => (
                          <div key={i}>
                            <span className={`simple-finding-icon ${f.status}`}>
                              {f.status === "satisfied" ? (
                                <Check size={16} />
                              ) : (
                                <TriangleAlert size={15} />
                              )}
                            </span>
                            <div>
                              <h4>{f.criterion}</h4>
                              <p>{f.explanation}</p>
                              <small>
                                {f.evidence.length
                                  ? `References: ${f.evidence.join(", ")}`
                                  : "No supporting reference"}
                              </small>
                            </div>
                          </div>
                        ))}
                      </div>
                      {job.report.missing.length > 0 && (
                        <div className="simple-missing">
                          <h4>What’s needed next</h4>
                          <ul>
                            {job.report.missing.map((m, i) => (
                              <li key={i}>{m}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <p className="simple-uncertainty">
                        {job.report.uncertainty}
                      </p>
                      <button className="simple-secondary" onClick={download}>
                        Download assessment JSON <ArrowUpRight size={15} />
                      </button>
                    </>
                  ) : (
                    <div className="simple-processing">
                      {job.state === "rejected" ? (
                        <TriangleAlert size={32} />
                      ) : (
                        <LoaderCircle className="simple-spin" size={32} />
                      )}
                      <h3>
                        {job.state === "rejected"
                          ? "Contract execution failed"
                          : job.hash
                            ? "GenLayer is reviewing the evidence"
                            : "Confirming submission"}
                      </h3>
                      <p>
                        {job.error ||
                          "Validators assess the evidence and agree on the result. This can take several minutes."}
                      </p>
                      {job.protocolStatus && (
                        <small>Network status: {job.protocolStatus}</small>
                      )}
                      <button
                        className="simple-secondary"
                        onClick={() => void refresh(job.id)}
                      >
                        Check status
                      </button>
                    </div>
                  )}
                  <div className="simple-proof">
                    <span>TRANSACTION RECORD</span>
                    <dl>
                      <dt>Request</dt>
                      <dd>{job.id}</dd>
                      {job.hash && (
                        <>
                          <dt>Transaction</dt>
                          <dd>{job.hash}</dd>
                        </>
                      )}
                      {job.contract && (
                        <>
                          <dt>Contract</dt>
                          <dd>{job.contract}</dd>
                        </>
                      )}
                      {job.manifestHash && (
                        <>
                          <dt>Evidence SHA-256</dt>
                          <dd>{job.manifestHash}</dd>
                        </>
                      )}
                    </dl>
                    <a
                      href="https://studio.genlayer.com"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Inspect in GenLayer Studio <ArrowUpRight size={13} />
                    </a>
                  </div>
                  {!pending && (
                    <button className="simple-secondary" onClick={reset}>
                      Start another assessment <ArrowRight size={15} />
                    </button>
                  )}
                </div>
              )}
            </section>
            <section className="simple-how">
              <span className="simple-how-icon">
                <Sparkles size={20} />
              </span>
              <div>
                <h3>Intelligence inside the contract.</h3>
                <p>
                  GenLayer’s Intelligent Contract evaluates your evidence using
                  AI and validator consensus, then records the assessment and
                  evidence hash.
                </p>
                <small>
                  The assessment reflects submitted text. It does not certify
                  physical work or release payments.
                </small>
              </div>
            </section>
          </div>
        </div>
        <div className="simple-footer">
          <span>
            SiteProof <span> / </span> Build with certainty.
          </span>
          <span>
            Powered by{" "}
            <a href="https://genlayer.com" target="_blank" rel="noreferrer">
              GenLayer <ArrowUpRight size={12} />
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}
