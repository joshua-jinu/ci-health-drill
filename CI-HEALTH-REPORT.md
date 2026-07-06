# CI Health Report — `ci-health-drill`

**Prepared for:** Team lead / sprint planning
**Scope:** Last 30 GitHub Actions runs across `CI` and `Security Scan` workflows
**Analyst branch:** `report/ci-health-analysis`
**Detailed data:** see [`CI-HISTORY-ANALYSIS.md`](./CI-HISTORY-ANALYSIS.md)

---

## 1. Executive Summary

Over the last 30 CI runs the pipeline failed **29 times — a 96.7% failure rate**. The dominant cause is not product code: the `test` job in `.github/workflows/ci.yml` runs `npm test` without ever installing dependencies, so Jest is missing and every run fails identically with `jest: not found` (exit code 127). This has trained the team to ignore CI entirely, which is why genuinely risky behavior has crept in unnoticed — a security scan was hard-disabled with `if: false`, an integration test that makes real network calls was toggled on and off, and urgent fixes were pushed straight to `main`.

The pipeline currently provides **no reliable ship/no-ship signal**. The top three risks are: **(1)** the misconfigured `test` job that makes CI 97% red *(Critical, Workflow Configuration)*; **(2)** the silently disabled Security Scan leaving `main` with no vulnerability gate *(Critical, Merge Safety)*; and **(3)** a flaky real-network integration test that produces non-deterministic pass/fail on identical commits *(High, Test Reliability)*. The fixes for risks 1 and 2 are low-effort and are applied in this same PR.

---

## 2. Workflow Observations

### Observation 1 — `test` job never installs dependencies (Workflow Configuration Quality)
- **Finding:** The `test` job checks out code and runs `npm test` with no preceding `npm ci`/`npm install` and no `needs: install`, so `node_modules` is empty and Jest is not present.
- **Evidence:** Runs **#1–#30** fail identically; even the docs-only commit `e497451 add newline to readme` (**run #28**) fails. Log snippet:
  ```
  > jest --forceExit
  sh: 1: jest: not found
  Error: Process completed with exit code 127.
  ```
  Frequency: **25 of 30 runs (83%)** fail from this exact cause.
- **Impact:** CI cannot verify a single commit. A 96.7% baseline failure rate means real regressions are indistinguishable from the standing red state — the team ships blind.

### Observation 2 — Security Scan workflow is hard-disabled (Merge Safety Indicators)
- **Finding:** `.github/workflows/security-scan.yml` gates its only job on `if: false`, so `npm audit` never executes on pushes to `main`.
- **Evidence:** Introduced by commit **`af8ec1c temp: disable scan until fixed`** (around **run #19**). The scan job appears **0 times** in the 30-run history. Log/config snippet:
  ```yaml
  jobs:
    scan:
      if: false    # Disabled — still broken, will fix in v1.1
  ```
- **Impact:** There is no automated vulnerability gate on the payment platform's `main` branch. Known-vulnerable dependencies can reach production undetected — unacceptable for a system handling money.

### Observation 3 — Flaky real-network gateway integration test (Test Reliability)
- **Finding:** An integration test issues a live HTTP request to `https://httpstat.us/200?sleep=100`, making the suite dependent on an external service's latency and availability.
- **Evidence:** Commit **`22d3b40 re-enable gateway integration test`** produced **run #23 (fail)** and **run #24 (pass)** on the *same commit*. Log snippet:
  ```
  Timeout - Async callback was not invoked within the 5000 ms timeout
    (payment gateway responds successfully) — src/payments/processPayment.test.js
  ```
  Frequency: **4 non-deterministic failures (#4, #9, #23, #25)** before it was `test.skip`-ed again in **run #30**.
- **Impact:** Non-deterministic tests destroy trust in CI and hide real gateway regressions. "Fixing" it by skipping (`aea721e skip flaky gateway test again`) removes coverage of the payment-gateway path entirely.

### Observation 4 — Direct pushes to `main`, EOL Node, and `npm install` (Validation Instability)
- **Finding:** Fixes are pushed directly to `main` without review, the CI pins EOL Node 16, and the `install` job uses `npm install` (non-deterministic) instead of `npm ci`.
- **Evidence:** Commits **`fbd120d hotfix: urgent payment fix`** (**run #12**) and **`0d9287c quick auth patch`** (**run #14**) land straight on `main`. Config snippet from `ci.yml`:
  ```yaml
  node-version: '16'    # Node 16 is EOL
  - run: npm install    # should be npm ci for reproducible installs
  ```
- **Impact:** No peer review on money-handling code, builds are not reproducible (lockfile can drift), and an unsupported runtime receives no security patches. Combined, these make every "green" result untrustworthy even once the test job is fixed.

### Observation 5 — Coverage gap masked by skipped test (Test Reliability)
- **Finding:** `validateAmount` never rejects negative amounts, and the test proving it is skipped rather than implemented.
- **Evidence:** `src/utils/validateAmount.test.js`:
  ```js
  test.skip('rejects negative amounts — not implemented yet', () => {
    expect(validateAmount(-50)).toBe(false);
  });
  ```
  `validateAmount.js` only checks `amount <= 0` — so the guard exists but the test is skipped, hiding intent. (Frequency: present in every run.)
- **Impact:** Skipping tests to keep the board green erodes coverage on financial input validation and normalizes hiding failures.

---

## 3. Risk Analysis Table

| Obs # | Finding summary | Risk Category | Severity |
|-------|-----------------|---------------|----------|
| 1 | `test` job runs `npm test` with no dependency install → 96.7% failure rate | Workflow Configuration Quality | **Critical** |
| 2 | Security Scan disabled via `if: false`; scan never runs on `main` | Merge Safety Indicators | **Critical** |
| 3 | Real-network gateway integration test is flaky, then skipped | Test Reliability | **High** |
| 4 | Direct pushes to `main`, EOL Node 16, `npm install` not `npm ci` | Validation Instability | **High** |
| 5 | Negative-amount validation test skipped, hiding coverage gap | Test Reliability | **Medium** |

---

## 4. Corrective Actions

### CA-1 — Install dependencies in the `test` job (addresses Observation 1) — **P1 (this sprint)**
- **Problem:** `test` job fails every run because `node_modules` is never populated (Obs 1).
- **Action:** Add `actions/setup-node` with dependency caching and an `npm ci` step before `npm test`. Chain the job with `needs: install` (or make `test` self-contained). Applied in this PR.
- **Tool / file:** `.github/workflows/ci.yml`.
- **Expected outcome:** `test` job runs Jest against installed deps; failure rate drops from **96.7% → reflects real test status** (currently 18 passing tests). Green builds become meaningful.

### CA-2 — Re-enable the Security Scan (addresses Observation 2) — **P1 (this sprint)**
- **Problem:** No vulnerability gate on `main`; scan hard-disabled with `if: false` (Obs 2).
- **Action:** Remove `if: false` so the `scan` job runs `npm audit --audit-level=high` on pushes to `main` and on PRs. Applied in this PR.
- **Tool / file:** `.github/workflows/security-scan.yml`.
- **Expected outcome:** Every push to `main` produces an audit result; high/critical CVEs block or alert. Coverage: **0% → 100%** of `main` pushes scanned.

### CA-3 — Replace the flaky integration test with a mocked gateway (addresses Observation 3) — **P2 (next sprint)**
- **Problem:** Live HTTP call to `httpstat.us` yields non-deterministic pass/fail; currently skipped, so the gateway path is untested (Obs 3).
- **Action:** Mock the HTTP layer (e.g. `nock` or `jest.mock('https')`) so the gateway test is deterministic and offline; then un-skip it. Move any true end-to-end check into a separate, non-blocking nightly job.
- **Tool / file:** `src/payments/processPayment.test.js`, add `nock` dev dependency.
- **Expected outcome:** Gateway test runs deterministically on every CI run with **0 network-induced flakes**; payment-gateway path regains coverage.

### CA-4 — Enforce branch protection and reproducible, supported builds (addresses Observation 4) — **P2 (next sprint)**
- **Problem:** Unreviewed direct pushes to `main`, EOL Node 16, non-reproducible `npm install` (Obs 4).
- **Action:** Enable GitHub branch protection on `main` (require PR + 1 review + passing CI, block direct pushes). Bump `node-version` to `20` (LTS) and switch the `install` job to `npm ci`. Node/`npm ci` fixes applied in this PR; branch protection is a repo-settings change for the lead.
- **Tool / file:** `.github/workflows/ci.yml` + GitHub → Settings → Branches.
- **Expected outcome:** **0 unreviewed commits** on `main`; reproducible installs from the lockfile; CI runs on a supported runtime.

### CA-5 — Implement and un-skip negative-amount validation (addresses Observation 5) — **P3 (backlog)**
- **Problem:** Negative-amount rejection test is skipped, hiding a money-validation coverage gap (Obs 5).
- **Action:** Confirm `validateAmount` rejects negatives (`amount <= 0` already does), remove the `test.skip`, and make it a normal passing test.
- **Tool / file:** `src/utils/validateAmount.test.js`.
- **Expected outcome:** **0 skipped tests** in the suite; explicit coverage of negative-amount rejection.

---

## 5. Reliability Evidence

> Screenshots of the specific failed runs from the GitHub Actions history should be attached here to prove the observations above. Capture each from the repository's **Actions** tab.

| Placeholder | What to capture | Proves |
|-------------|-----------------|--------|
| `evidence/run-28-jest-not-found.png` | Run #28 (docs-only commit `add newline to readme`) `test` job log showing `sh: 1: jest: not found` / exit code 127 | Observation 1 (config failure independent of code) |
| `evidence/failure-rate-history.png` | Actions list view showing the wall of red across the last 30 runs | 96.7% failure rate |
| `evidence/security-scan-absent.png` | Actions → Workflows list showing `Security Scan` with no runs, plus the `if: false` line in the workflow file | Observation 2 |
| `evidence/run-23-vs-24-gateway.png` | Runs #23 (fail, timeout) and #24 (pass) on the same commit | Observation 3 (flaky, non-deterministic) |
| `evidence/main-direct-push.png` | Commit history on `main` showing `hotfix: urgent payment fix` / `quick auth patch` pushed directly | Observation 4 |

*Screenshots to be added by the analyst before final submission (the images live in an `evidence/` folder committed alongside this report).*
