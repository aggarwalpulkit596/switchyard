# Security

## Trust boundaries

- The **controller** (API + worker) holds Railway credentials. It runs in its own Railway project, separate from any target it supervises.
- The **probe runner** receives only the credentials it needs: the rehearsal app URL and a fixture-scoped database role.
- The **webhook receiver** authenticates Railway deliveries with a secret custom header (Railway payloads are not signed). Receipts are deduplicated and never trigger mutations directly.
- **Evidence bundles** are redacted before sealing. Logs shown in the UI pass through the same redactor.

## Reporting

This is a demonstration project. Report issues privately to the maintainer rather than in public issues.
