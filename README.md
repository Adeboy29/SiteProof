# SiteProof

A simple construction milestone assessment website powered by a real GenLayer Intelligent Contract.

Enter a milestone, acceptance criteria and evidence text. The Python contract uses GenLayer AI execution and validator consensus to assess each criterion. The website tracks the actual transaction and reads the finalized report and SHA-256 evidence fingerprint from the contract.

No account or Supabase project is required for the main page. There is no simulated assessment fallback.

## Run locally

Requires Node.js 24 and an internet connection.

```sh
npm ci
npm run contract:deploy
npm run dev
```

Open http://127.0.0.1:3000. Click **Load example**, review the synthetic evidence, approve public submission, then **Run Intelligent Contract**. Consensus may take several minutes.

`contract:deploy` creates a dedicated Studio test signer in `.env.local` if needed, deploys the contract, waits for finalization, verifies ownership and saves the actual address. Re-running resumes the recorded deployment. A fresh clone creates its own signer and contract. Never upload `.env.local` or private keys to GitHub.

For a production build of this local demo:

```sh
npm run build
npm start
```

On this prepared Windows workspace, double-click `outputs/Start-SiteProof.cmd` after building. Keep the terminal open and use the address printed there.

## Verified execution

`deployments/simple-verification.json` records an actual completed synthetic submission, its contract report and matching evidence hash:

- Network: GenLayer **stable Studionet**, chain ID 61999.
- Contract: `0x466c24Cb78e63B1eA3EA6a0B81CF1CcDaE7A2581`
- Assessment transaction: `0xc0a68b11270dbfb8b30ee00a4022e02177894aa175c9c99fc0965ce16fc2a39a`
- Result: **Requirements not satisfied** (22 MPa reported; 25 MPa required).

Inspect the address and transaction in [GenLayer Studio](https://studio.genlayer.com). This is hosted Studio consensus, not a Bradbury deployment. Studio state can reset. See `HACKATHON.md` for the verification record and demo script.

After confirming a Studio reset or intentionally creating a replacement, use `npm run contract:deploy -- --new`. This preserves the old journal and deploys a new contract; restart the website to load its address.

## How it works

1. `app/page.tsx`: responsive one-page form and transaction/result panel.
2. `app/api/assess/route.ts`: validates the request, hashes the evidence, journals it and signs a real `assess` call with the server's dedicated Studio wallet.
3. `contracts/siteproof.py`: evaluates the manifest with `gl.nondet.exec_prompt` and `gl.vm.run_nondet_unsafe`, with independent validator judgment. Stores immutable request results and manifest hashes.
4. Status requests wait for actual finalization, read `get_assessment` and `get_manifest_hash`, and verify the report's identity, criteria, citations and hash before displaying it.

The simple flow pins official `genlayer-js` **1.1.8** under the npm alias `genlayer-js-stable`, compatible with stable Studionet. The older expanded workspace's RC adapter remains in the source but is not used by the main page.

## Configuration and persistence

The deploy command sets `GENLAYER_PRIVATE_KEY`, `GENLAYER_CONTRACT_ADDRESS` and `GENLAYER_NETWORK=studionet` in ignored `.env.local`. Keep the signer server-side. `npm run doctor` checks connection and ownership without exposing the key.

Assessment journals live in `work/assessments`. For a hosted demo, use a **single persistent Node.js server** with a writable, durable `SITEPROOF_DATA_DIR`. This implementation is not configured for stateless Vercel functions or multiple instances. It serializes signer submissions, caps the demo at 10 submissions/hour, and never automatically repeats an ambiguous broadcast. A lock left after a crash requires operator review of the stored job and chain before removal.

Only submitted text and optional user-attributed inspection notes are assessed; PDFs/photos are not parsed in this simple version. Text is sent to the public Studio network after consent. Inspector identity and physical work are not independently authenticated. Assessments do not release money or certify site safety.

## Checks

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm run test:live
```

`test:live` starts a temporary local server and submits public synthetic evidence once; reruns resume its recorded transaction. It requires the configured Studio contract and network access. Unit/API tests use mocks and do not count as live execution proof. Python contract tests use the official direct GenVM runner with mocked AI outputs:

```sh
python -m pip install genlayer-test==0.29.2
python scripts/prepare-contract-runtime.py
python -m pytest tests/test_contract.py -v
```

Historical Supabase/workspace modules remain for reference. They are not required for the simple root page and are not part of its demo.
