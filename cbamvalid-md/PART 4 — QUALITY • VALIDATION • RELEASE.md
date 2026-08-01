━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 4 — QUALITY • VALIDATION • RELEASE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

QUALITY PHILOSOPHY

Implementation is only 30% of the work.

Validation is 70%.

Never trust code that has not been validated.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VALIDATION STRATEGY

Every task must pass

Syntax Validation

↓

Type Validation

↓

Build Validation

↓

Runtime Validation

↓

Business Validation

↓

Regression Validation

↓

Production Validation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BUILD ENGINE

Verify

Compilation

Bundling

Module Resolution

Environment Variables

Dynamic Imports

Tree Shaking

Static Assets

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TYPE ENGINE

Zero type errors.

Never ignore.

Never suppress.

Never bypass.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LINT ENGINE

Warnings are not success.

Resolve

unused code

unsafe code

duplicate logic

incorrect patterns

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RUNTIME ENGINE

Validate

Application Startup

Navigation

Page Rendering

Hydration

SSR

CSR

Lazy Loading

Dynamic Imports

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CONSOLE ENGINE

Mission Complete forbidden if

Console contains

Errors

Unhandled Promise

Warnings indicating logic issues

Repeated warnings

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NETWORK ENGINE

Verify

400

401

403

404

409

429

500

502

503

504

Failed Requests

Timeouts

Unexpected Redirects

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

API VALIDATION

Validate

Request

Response

Serialization

Validation

Timeout

Retry

Error Handling

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STATE VALIDATION

Verify

Initialization

Persistence

Synchronization

Reset

Cleanup

Race Conditions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REGRESSION ENGINE

Every change requires checking

Direct Target

↓

Direct Dependency

↓

Shared Module

↓

Affected Feature

↓

Affected Workflow

↓

Production Flow

Never perform repository-wide regression unless architecture changed.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WORKFLOW VALIDATION

Validate complete user flow.

Not isolated functions.

Think like user.

Not developer.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PERFORMANCE VALIDATION

Verify

First Paint

Interactive Time

Bundle Size

Memory

CPU

Rendering

Requests

Cache

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SEO VALIDATION

If page affected

verify

Title

Description

Canonical

OpenGraph

Twitter

Schema

Internal Links

Sitemap

robots.txt

llms.txt

Structured Data

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ACCESSIBILITY VALIDATION

Verify

Keyboard

ARIA

Labels

Contrast

Focus

Navigation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECURITY VALIDATION

Verify

Authentication

Authorization

Input Validation

Output Encoding

Secrets

Permissions

Headers

Cookies

Rate Limits

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ERROR RECOVERY ENGINE

Every failure requires

Detection

↓

Explanation

↓

Recovery

↓

Validation

Never fail silently.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ROLLBACK ENGINE

Before every important change determine

Rollback Strategy

Rollback Risk

Rollback Cost

Rollback Time

Rollback Trigger

Never perform irreversible changes blindly.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DEPLOYMENT ENGINE

Before deployment verify

Configuration

Environment

Secrets

API

Database

Build

Assets

Routing

Cache

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRODUCTION SAFETY

Production always has priority.

If uncertainty exists

Do not deploy.

Investigate first.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TECHNICAL DEBT REVIEW

Before release verify

No duplicated logic

No dead code

No unused imports

No temporary workaround

No hidden assumptions

No unnecessary complexity

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MISSION REVIEW

Before completion answer internally

Did I solve the requested problem?

Did I introduce another problem?

Did I increase maintenance cost?

Did I reduce system quality?

Can another engineer understand this?

Can another engineer maintain this?

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RELEASE GATE

Mission Complete forbidden unless

✓ Build PASS

✓ Type PASS

✓ Lint PASS

✓ Runtime PASS

✓ Console PASS

✓ Network PASS

✓ API PASS

✓ State PASS

✓ Regression PASS

✓ Performance PASS

✓ Security PASS

✓ Accessibility PASS

✓ SEO PASS

✓ Technical Debt PASS

✓ Rollback Defined

✓ Production Safe

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FINAL RELEASE LAW

Never release because implementation finished.

Release only because validation finished.

Evidence

>

Implementation

Production Safety

>

Feature Speed

END OF PART 4