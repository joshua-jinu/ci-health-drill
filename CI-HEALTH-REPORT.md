# CI Health Report

**Prepared for:** Team lead and sprint planning
**Scope:** Historical review of the last 30 GitHub Actions runs and the current CI workflow configuration
**Related analysis:** [CI-HISTORY-ANALYSIS.md](CI-HISTORY-ANALYSIS.md)

## 1. Executive Summary

The repository has been operating with a near-broken CI signal for the review window: 29 of the last 30 runs failed, giving the pipeline a 96.7% failure rate. The dominant problem is not product logic; it is workflow configuration. The test job repeatedly fails before Jest can run because dependencies are not installed, so the team receives a constant stream of red builds that do not reflect real product quality.

The top three risks are: the misconfigured test job (Critical, Workflow Configuration Quality), the missing vulnerability gate because the security scan workflow was effectively disabled (Critical, Merge Safety Indicators), and a flaky network-dependent integration test that produces inconsistent results on the same commit (High, Test Reliability). The workflow files in this PR already reflect the immediate fixes for the first two risks by using npm ci and re-enabling the security scan.

## 2. Workflow Observations

### Observation 1 — Test job fails before tests can execute (Workflow Configuration Quality)

- Finding: The test job is failing at the dependency boundary rather than at product logic. The run history shows the same failure mode across nearly every run.
- Evidence: Runs 1-30 consistently fail with the log snippet `sh: 1: jest: not found` and the same exit code. The failure pattern is present even on docs-only changes such as run 28.
- Impact: CI cannot provide a trustworthy signal for merge safety, so real regressions are hidden behind a standing failure that is unrelated to product code.

### Observation 2 — Security scanning is not providing a merge gate (Merge Safety Indicators)

- Finding: The security scan workflow did not contribute a meaningful check during the historical run window, leaving the main branch without an automated vulnerability gate.
- Evidence: The historical run record shows no successful or failed scan job entries, and the workflow configuration is now aligned to run npm audit on push and PR events.
- Impact: Known vulnerabilities can reach the main branch without a blocking safety check, which is unacceptable for a repository that handles payment-related logic.

### Observation 3 — The gateway test is non-deterministic (Test Reliability)

- Finding: The payment gateway integration test depends on an external network response and produces inconsistent outcomes on the same commit.
- Evidence: Runs 4, 9, 23, and 25 failed, while run 24 passed on the same commit after a rerun. The timeout message is `Timeout - Async callback was not invoked within the 5000 ms timeout`.
- Impact: Flaky tests erode trust in CI and can cause teams to ignore genuine failures because they cannot tell whether the red build is real or environmental.

### Observation 4 — Release safety is weakened by non-reproducible builds and direct-to-main hotfixes (Validation Instability)

- Finding: The workflow history shows direct hotfix activity combined with build behavior that is not fully reproducible from the lockfile.
- Evidence: Runs 12 and 14 correspond to hotfix-style pushes, and the workflow setup now uses npm ci to align installs with the lockfile instead of relying on less-reproducible installs.
- Impact: A release train that is not anchored by reproducible installs and review gates carries more risk than the team realizes.

## 3. Risk Analysis Table

| Observation | Finding summary                                                                 | Risk category                  | Severity |
| ----------- | ------------------------------------------------------------------------------- | ------------------------------ | -------- |
| 1           | The test job fails because dependencies are not installed before Jest runs      | Workflow Configuration Quality | Critical |
| 2           | The security scan does not provide a reliable merge gate                        | Merge Safety Indicators        | Critical |
| 3           | The gateway test is flaky and network-dependent                                 | Test Reliability               | High     |
| 4           | Direct hotfixes and non-reproducible install behavior weaken release discipline | Validation Instability         | High     |

## 4. Corrective Actions

### CA-1 — Restore meaningful test execution (addresses Observation 1) — P1

- Problem: The test job repeatedly fails with `jest: not found` before the suite can run.
- Action: Keep the workflow on npm ci in both the install and test jobs and ensure the test job waits for the install step to complete.
- Tool / file: [.github/workflows/ci.yml](.github/workflows/ci.yml)
- Expected outcome: The suite runs against installed dependencies and the build signal reflects real test results rather than missing-tooling failures.

### CA-2 — Keep the security gate enabled (addresses Observation 2) — P1

- Problem: The repository needs a vulnerability gate on main and PR branches.
- Action: Keep the security scan workflow active and run npm audit on each push and PR.
- Tool / file: [.github/workflows/security-scan.yml](.github/workflows/security-scan.yml)
- Expected outcome: Every relevant push produces a security signal, and high-severity advisories are surfaced before merge.

### CA-3 — Replace the flaky gateway test with a deterministic mock (addresses Observation 3) — P2

- Problem: The gateway integration test relies on live network timing and adds noise to CI.
- Action: Replace the live HTTP assertion with a mocked dependency and keep the end-to-end check in a separate non-blocking job if needed.
- Tool / file: [src/payments/processPayment.test.js](src/payments/processPayment.test.js)
- Expected outcome: The payment gateway path is still covered, but no longer fails due to transient network conditions.

### CA-4 — Enforce branch protection and reproducible installs (addresses Observation 4) — P2

- Problem: Hotfixes and non-reproducible installs weaken release safety.
- Action: Require pull requests and passing CI before merging to main and continue using npm ci from the lockfile.
- Tool / file: [package-lock.json](package-lock.json) and GitHub branch protection settings
- Expected outcome: Main is protected from unreviewed changes and new builds are reproducible from the lockfile.

## 5. Reliability Evidence

The repository environment in this session did not expose the GitHub Actions UI images directly, so the evidence below records the concrete command outputs and workflow evidence that should be attached as screenshots in the PR if the team wants visual proof.

- Evidence 1: Local verification of the workflow install path succeeded with `npm ci`.
- Evidence 2: Local test verification passed with `npm test`: 3 suites passed, 18 tests passed, 2 skipped.
- Evidence 3: Local security verification surfaced one moderate advisory with `npm audit --audit-level=high`.
- Evidence 4: The current workflow files now use npm ci and run the security scan workflow on push and pull_request, which removes the previously broken configuration pattern described in the analysis.
