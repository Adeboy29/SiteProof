# SiteProof hackathon demo

**Website:** [https://siteproof-adeboy29.fasure333.chatgpt.site](https://siteproof-adeboy29.fasure333.chatgpt.site)

**Source:** [Adeboy29/SiteProof](https://github.com/Adeboy29/SiteProof)

SiteProof assesses construction milestone evidence through a real GenLayer Intelligent Contract. The public app has one page: enter a milestone, acceptance criteria and evidence, execute the contract, then view the finalized assessment and transaction record.

## Reproduce the public demonstration

1. Open the public website. If a previous assessment is displayed, click Start another assessment.
2. Click Load example and review the synthetic concrete-test evidence and inspector notes.
3. Approve public submission and click Run Intelligent Contract.
4. Wait for actual finalization. The example reports 22 MPa against a 25 MPa requirement, while identifying the required Block A sample.
5. Review criterion findings, the transaction and evidence fingerprint. Download assessment JSON.

## Verified public execution — 15 October 2026

- Network: GenLayer stable Studionet / hosted Studio, chain ID 61999.
- SDK: official genlayer-js 1.1.8, installed as genlayer-js-stable.
- Active contract: `0x6dC15c69e92BE6D5a657510aE790070354276C4E`
- Contract source SHA-256: `cff38eabcacbc5d37716f9ec2b21b69ca2d338008a09ff4c6c88819fdd1aa9a4`
- Deployment transaction: `0x8cf180db69d1818d9977f9690c39e9de3bdf68d634b3e40476759c071e307151`
- Assessment request: `4f67d985-68d5-481a-a3b8-cfc2c5869f44`
- Assessment transaction: `0x79a79d8f1f5232ab915ae0a35cf704e4dd05d224c793907b75834430ae209743`
- Manifest SHA-256: `34b3f0882c7dab6067f38cbea8ebb626107c319e36a21152f1e17c2b2d177357`
- State: FINALIZED with successful execution and validator agreement.
- Outcome: Requirements partially satisfied.

The test submitted the built-in example through the public browser form. The hosted API read the finalized report and anchored manifest hash from GenLayer and checked report identity, original criteria and citations. Full result: [hosting/deployments/hosted-verification.json](hosting/deployments/hosted-verification.json). The website also preserved an earlier request across a hosting redeployment.

## Intelligent Contract execution

The assess write method invokes gl.nondet.exec_prompt. Validators independently repeat the assessment through gl.vm.run_nondet_unsafe and compare ordered criterion decisions. The overall outcome is derived deterministically from those decisions. Missing-evidence prose, explanations and valid citation choices can vary without causing false disagreement. Deterministic checks enforce identity, original criteria, allowed statuses and supplied citation IDs. Any insufficient criterion forces an insufficient-evidence outcome and human-inspection flag. Reports and exact manifest hashes are immutable per request.

The hosted application source is in hosting/. It uses Vinext, Cloudflare Workers, persistent D1 storage and protected server secrets. Transaction reservations and the 10-submissions/hour cap are enforced transactionally across Worker instances. Ambiguous broadcasts are not retried automatically. The root Next.js application remains the local version.

## Scope

This verifies real hosted Studio execution, not Bradbury deployment. Studio can reset. Evidence is submitted text and user-attributed inspection notes; authenticity, inspector identity and physical completion are not independently certified. No payment transfer occurs. Verification evidence is synthetic and public. Private keys and local environment files are excluded from source control.

Hackathon eligibility and any requirement for a particular testnet have not been confirmed because no event rules were supplied. The earlier local execution record is retained in deployments/simple-verification.json as historical evidence against its recorded earlier contract.
