# Failure Mode Register - CBAM Sealing & Evidence Lifecycle

This register logs potential failure modes, their impact on the sealing and evidence lifecycles, and their corresponding server-side mitigations.

| Failure Mode | Impact | Severity | Mitigation Strategy |
|---|---|---|---|
| Client attempts to submit stale case data during seal request | Incorrect calculations and out-of-sync values in final sealed report | High | Load authoritative case revision directly from Firestore using authenticated uid and caseId on the server. Reject any direct browser-submitted case data payload. |
| Client bypasses quality controls and forces seal status | Non-compliant or missing data files end up in sealed reports | Critical | Run strict quality controls (runQualityControls) on the server in the sealing function. Throw error and abort transaction if any blocker is detected. |
| Cross-tenant case access or evidence upload traversal | unauthorized users view or overwrite other tenants' private evidence files | Critical | Scope all Storage and Firestore documents strictly using tenant uid. Apply Firestore and Storage security rules enforcing `auth.uid == resource.data.uid`. |
| Concurrency race condition on credit purchase / seal use | Exporter gets more than 5 releases or overuses credits | High | Run entitlement reservation and consumption inside firestore database transactions (`runTransaction`) with atomic counters and lock flags. |
| Expired or absent regulatory ruleset | calculations default to generic or incorrect emission factors | High | Resolution logic checks active dates. Calculation halts with failure if ruleset is unproven or absent. |
| Failure during artifact upload in two-phase commit | Stale or missing files in ZIP package; orphaned files in Storage | Medium | Transactionally write report record only after all file uploads succeed and read-back hashes match. Clean up upload directory on transaction abort. |
