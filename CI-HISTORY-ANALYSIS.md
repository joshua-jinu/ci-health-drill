# CI History Analysis

**Repository:** ci-health-drill
**Scope:** Historical review of the last 30 GitHub Actions runs in the assignment dataset
**Workflows analyzed:** CI and Security Scan
**Prepared for:** CI health review and sprint planning

## Task 1 — Run History (last 30 runs)

| #   | Date       | Outcome | First failing job | Failure tied to code change?         |
| --- | ---------- | ------- | ----------------- | ------------------------------------ |
| 30  | 2026-05-27 | ❌      | test              | No — config / flaky test suppression |
| 29  | 2026-05-27 | ❌      | test              | No — docs-only change, still fails   |
| 28  | 2026-05-27 | ❌      | test              | No — docs-only change                |
| 27  | 2026-05-27 | ❌      | test              | No — config                          |
| 26  | 2026-05-27 | ❌      | test              | No — config                          |
| 25  | 2026-05-26 | ❌      | test              | Yes — flaky gateway network test     |
| 24  | 2026-05-26 | ✅      | —                 | No — rerun passed on retry           |
| 23  | 2026-05-26 | ❌      | test              | Yes — flaky gateway network test     |
| 22  | 2026-05-25 | ❌      | test              | No — config                          |
| 21  | 2026-05-25 | ❌      | test              | No — config                          |
| 20  | 2026-05-24 | ❌      | test              | No — config                          |
| 19  | 2026-05-24 | ❌      | test              | No — config                          |
| 18  | 2026-05-23 | ❌      | test              | No — config                          |
| 17  | 2026-05-23 | ❌      | test              | No — config                          |
| 16  | 2026-05-22 | ❌      | test              | No — config                          |
| 15  | 2026-05-22 | ❌      | test              | No — config                          |
| 14  | 2026-05-21 | ❌      | test              | No — config                          |
| 13  | 2026-05-21 | ❌      | test              | No — config                          |
| 12  | 2026-05-20 | ❌      | test              | No — config                          |
| 11  | 2026-05-20 | ❌      | test              | No — config                          |
| 10  | 2026-05-19 | ❌      | test              | No — config                          |
| 9   | 2026-05-19 | ❌      | test              | Yes — flaky gateway network test     |
| 8   | 2026-05-18 | ❌      | test              | No — config                          |
| 7   | 2026-05-18 | ❌      | test              | No — config                          |
| 6   | 2026-05-17 | ❌      | test              | No — config                          |
| 5   | 2026-05-17 | ❌      | test              | No — config                          |
| 4   | 2026-05-16 | ❌      | test              | Yes — flaky gateway network test     |
| 3   | 2026-05-16 | ❌      | test              | No — config                          |
| 2   | 2026-05-15 | ❌      | test              | No — config                          |
| 1   | 2026-05-15 | ❌      | install + test    | No — config                          |

### Failure rate

- Total runs analyzed: 30
- Failed runs: 29
- Passed runs: 1
- Failure rate: 29 / 30 = 96.7%

### Breakdown of failures by job

| Failing job | Count             | Notes                                                                                 |
| ----------- | ----------------- | ------------------------------------------------------------------------------------- |
| test        | 29                | Dominant failure mode; often caused by missing dependencies or flaky gateway behavior |
| install     | 0 direct failures | Structural issue: install step did not feed the test job reliably                     |
| scan        | 0 recorded runs   | Security workflow was effectively disabled in the historical window                   |

### Flaky vs. consistent classification

- Consistent failures: 25 of 29 failures
  - Same recurring error: `sh: 1: jest: not found`
  - This is deterministic and caused by the test job not installing dependencies before running Jest.
- Flaky failures: 4 of 29 failures
  - The gateway integration test timed out intermittently on real network calls.
  - The same commit produced both a fail and a pass on rerun, which is the hallmark of a non-deterministic test.

## Task 2 — Failure Pattern Classification

| Pattern                                                      | Risk category                  | Evidence                                                                                 | Frequency      | Severity |
| ------------------------------------------------------------ | ------------------------------ | ---------------------------------------------------------------------------------------- | -------------- | -------- |
| Missing dependency install before Jest                       | Workflow Configuration Quality | Runs 1-30 repeatedly fail with `jest: not found`; docs-only change on run 28 still fails | Very high      | Critical |
| Flaky real-network gateway test                              | Test Reliability               | Runs 4, 9, 23, and 25 fail, while run 24 passes on rerun                                 | Medium         | High     |
| Security scan workflow effectively disabled                  | Merge Safety Indicators        | No scan job appears in the 30-run history; the workflow was previously suppressed        | Always present | Critical |
| Direct pushes to main with non-reproducible install behavior | Validation Instability         | Direct hotfix runs and non-reproducible install behavior erode trust in release quality  | High           | High     |
