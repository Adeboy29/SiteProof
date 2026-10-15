import Link from "next/link";
import {
  Building2,
  ArrowRight,
  ShieldCheck,
  Layers,
  FolderCheck,
  Scale,
} from "lucide-react";
export default function Home() {
  return (
    <div className="marketing">
      <header>
        <Link className="brand" href="/home">
          <span className="brand-icon">
            <Building2 />
          </span>
          SiteProof<span className="brand-dot">.</span>
        </Link>
        <Link className="primary" href="/">
          Open workspace <ArrowRight size={16} />
        </Link>
      </header>
      <section className="marketing-hero">
        <span className="tag">
          Construction progress. A shared source of clarity.
        </span>
        <h1>
          Build with certainty.
          <br />
          Verify with evidence.
        </h1>
        <p>
          Turn construction milestone disagreements into a clear, documented
          review. Agree on the work, collect the evidence, and give every
          decision a traceable foundation.
        </p>
        <Link className="primary" href="/">
          Start your project <ArrowRight size={16} />
        </Link>
        <a className="secondary" href="#process">
          See how it works
        </a>
        <div className="hero-record">
          <div className="flex">
            <Building2 />
            <span className="tag">Product demonstration</span>
          </div>
          <h2>Foundation & site preparation</h2>
          <p>Agreed criteria v1 · Evidence submitted · Review requested</p>
          <div className="criterion">
            <FolderCheck />
            <span>
              Photographs and inspection reports linked to content hashes
            </span>
          </div>
          <div className="criterion">
            <ShieldCheck />
            <span>
              Criterion-by-criterion findings with uncertainty explained
            </span>
          </div>
          <div className="criterion">
            <Scale />
            <span>Independent inspection when evidence is inconclusive</span>
          </div>
        </div>
      </section>
      <section id="process" className="marketing-process">
        <div className="eyebrow">FROM AGREEMENT TO ASSESSMENT</div>
        <h1>A better record. A clearer next step.</h1>
        <p>
          Disagreements happen when scope, evidence, and expectations drift
          apart. Keep them together.
        </p>
        <div className="stats">
          {[
            [
              "01",
              "Agree on the work",
              "Define objective acceptance criteria and payment conditions before work begins.",
            ],
            [
              "02",
              "Document progress",
              "Contractors and inspectors provide attributed evidence in private storage.",
            ],
            [
              "03",
              "Assess the evidence",
              "A GenLayer Intelligent Contract independently evaluates the permitted evidence manifest.",
            ],
            [
              "04",
              "Review and decide",
              "See findings, request additional evidence, or escalate to a qualified human inspector.",
            ],
          ].map(([n, t, d]) => (
            <div className="stat" key={n}>
              <strong>{n}</strong>
              <h3>{t}</h3>
              <p>{d}</p>
            </div>
          ))}
        </div>
        <div className="panel">
          <h2>Decentralized judgment, with clear limits.</h2>
          <p>
            GenLayer validators independently judge an assessment under explicit
            protocol rules. Consensus does not establish physical truth.
            SiteProof shows the actual transaction lifecycle and separates
            finalized assessments from drafts and development results.
          </p>
          <p>
            SiteProof does not replace qualified engineers, physical
            inspections, regulations or legal proceedings. No real money is
            transferred automatically.
          </p>
        </div>
      </section>
      <footer>
        <span>© SiteProof</span>
        <Link href="/">Open dashboard →</Link>
      </footer>
    </div>
  );
}
