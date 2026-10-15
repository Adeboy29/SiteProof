# SiteProof hackathon demo

SiteProof reviews construction milestone evidence through a GenLayer Intelligent Contract. The submission is deliberately small: one page, one evidence manifest, one actual contract transaction, one traceable assessment.

## Demonstration

1. Run the site as described in README.md.
2. Click Load example. This supplies clearly marked synthetic concrete-test evidence.
3. Review the criteria and evidence; approve public submission.
4. Click Run Intelligent Contract. Show the actual transaction hash and consensus status.
5. After finalization, show criterion findings, uncertainty and the on-chain evidence hash. Download the assessment JSON.

A finding that evidence is insufficient or a requirement is not satisfied is a valid result, not a failed application transaction.

## Confirmed live proof (2026-10-13)

Network: stable GenLayer Studionet / hosted Studio, chain ID 61999.

Official SDK: genlayer-js 1.1.8, installed as genlayer-js-stable.

Contract source: contracts/siteproof.py

Contract SHA-256: 2acc014c4cbcccf02c06f5380729412d4734352533918d0028fbd14b2b9c0ecb

Deployment transaction: 0xfeb7603299bafdf663e3e31fbac35f092ecab21a8648564c02a86c1151ec5a01

Contract address: 0x466c24Cb78e63B1eA3EA6a0B81CF1CcDaE7A2581

Assessment request: a48d7fe0-69fa-4c61-8e12-da863ab48d1d

Assessment transaction: 0xc0a68b11270dbfb8b30ee00a4022e02177894aa175c9c99fc0965ce16fc2a39a

Manifest hash: 01c8b19d7b26abab332510a4f739ef321fcdc2e195261b8a123bb5170694db40

Final state: FINALIZED / successful execution / MAJORITY_AGREE.

Returned outcome: Requirements not satisfied. The contract identified reported strength of 22 MPa against the 25 MPa criterion and cited evidence-1 and inspection-1.

The test called the website POST and GET assessment APIs, waited for real network finalization, read the report and hash back from the contract, and verified them against the original submission. Full public fixture and report: deployments/simple-verification.json. Deployment journal: deployments/simple-studionet.json. Inspect these records in [GenLayer Studio](https://studio.genlayer.com).

## Intelligent Contract execution

The assess write method invokes gl.nondet.exec_prompt. The leader proposes a structured report. Validators independently evaluate evidence through gl.vm.run_nondet_unsafe and compare stable decision fields. Deterministic checks constrain report identity, ordered criteria, allowed outcomes and citations. The contract stores immutable reports and exact manifest SHA-256 hashes. The web server signs and tracks transactions; it does not generate assessments itself.

## Scope and limits

This verifies hosted Studio execution, not Bradbury deployment. Studio can reset. The site currently runs locally; uploading code to GitHub does not host its server. A hosted demo needs one persistent Node server and server-side configuration.

Evidence is text and optional user-attributed inspection notes. Inspector identity, source authenticity and physical completion are not independently verified. No payment transfer occurs. Verification evidence in this repo is synthetic and public. Never commit .env.local or a private key.

Hackathon eligibility and any requirement for a particular public testnet have not been confirmed because no event rules or URL were supplied.
