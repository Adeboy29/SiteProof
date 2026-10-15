# SiteProof — hosted application

One page for assessing construction milestone evidence through a real GenLayer Intelligent Contract.

The interface and contract match the local SiteProof project. This hosted version uses Vinext on Cloudflare Workers and persistent D1 records instead of local filesystem journals. No visitor account or database setup is needed to use the public page.

## Use the site

1. Click **Load example**, or enter a milestone, acceptance criteria and evidence text.
2. Review optional inspector notes and approve public submission.
3. Click **Run Intelligent Contract**. Keep the request ID and transaction hash while validators process the assessment.
4. Read the finalized report and download its JSON record.

The server reads finalized reports and manifest hashes directly from GenLayer. It verifies identity, criteria, citations and the exact manifest fingerprint before displaying a result. There is no fabricated assessment fallback.

## Hosting configuration

`.openai/hosting.json` declares the Site identity and the D1 binding `DB`. Hosted runtime values are configured as protected Sites secrets:

- `GENLAYER_PRIVATE_KEY`: dedicated Studio server signer, never sent to the browser.
- `GENLAYER_CONTRACT_ADDRESS`: deployed SiteProof contract owned by that signer.
- `GENLAYER_NETWORK`: `studionet`.
- `SITEPROOF_PUBLIC_ORIGIN`: the exact published origin allowed to submit evidence.

The official `genlayer-js` SDK 1.1.8 is pinned as `genlayer-js-stable` for stable Studio compatibility. The pinned Python contract source is `contracts/siteproof.py`. The earlier finalized synthetic execution proof is in `deployments/simple-verification.json`.

## Persistent transaction handling

`lib/assessment-store.ts` uses a transactional D1 batch to enforce one signer reservation, immutable request IDs and the global 10-submissions/hour cap across Worker instances. A repeated request tracks the saved transaction rather than broadcasting again. An ambiguous broadcast stays unresolved. If execution is interrupted before a hash can be saved, the signer reservation remains until an operator checks the chain and stored request; it is never automatically retried.

Migrations are generated from `db/schema.ts` and applied by Sites before publishing. Applied migration history is immutable. See `docs/HOSTING-OPERATIONS.md` for local migration and framework commands.

## Validation

```sh
npm ci
npm test
npx tsc --noEmit
npm run build
```

Storage tests run the actual generated SQL with SQLite and cover concurrent reservations, duplicate requests, ambiguous broadcasts, failed database updates and the persistent hourly limit.

## Scope

GenLayer Studio is a hosted development network and can reset. Assessments use submitted text and user-attributed inspector notes; they do not independently authenticate sources, certify physical work, or transfer payments. All included verification fixtures are synthetic and public. Keep private keys and local environment files out of source control.
