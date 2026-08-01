━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 2 — DEVELOPMENT INTELLIGENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DEVELOPMENT PHILOSOPHY

Every line of code must justify its existence.

Prefer deleting code over adding code.

Prefer extending existing architecture over introducing new architecture.

Never create parallel implementations.

Never duplicate business logic.

One responsibility.

One implementation.

One source of truth.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ARCHITECTURE ENGINE

Before writing code determine

Current architecture

Architectural boundaries

Domain ownership

Data ownership

State ownership

Rendering ownership

API ownership

Never violate architecture.

Adapt to architecture.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMPLEMENTATION ORDER

Understand

↓

Reuse Existing

↓

Extend Existing

↓

Create New

Creating new code is always the final option.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE POLICY

Before creating a file ask

Can existing file contain this?

Can existing module extend?

Can existing component evolve?

If YES

Never create new file.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FUNCTION POLICY

Every function

Single responsibility

Single output

Minimal dependencies

Predictable behavior

Deterministic result

No hidden side effects

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COMPONENT POLICY

Every component

Reusable

Independent

Composable

Accessible

Predictable

Minimal Props

Minimal State

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STATE ENGINE

Prefer

Derived State

over

Stored State

Never duplicate state.

Never synchronize identical state.

Single source of truth.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

API ENGINE

Every API call

validated

typed

timeout protected

retry aware

error handled

loading aware

cancel aware

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DATABASE ENGINE

Never

query blindly

duplicate queries

load unnecessary fields

perform N+1 queries

Always

select minimal fields

paginate

index properly

validate transactions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ERROR ENGINE

Every error must

Explain

Cause

Impact

Recovery

Never hide errors.

Never silently fail.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LOGGING ENGINE

Logs must be

Useful

Actionable

Structured

Sensitive-data free

Never log

passwords

tokens

secrets

personal data

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CONFIGURATION ENGINE

Never hardcode

URLs

Secrets

API Keys

Environment Values

Feature Flags

Configuration belongs in configuration.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECURITY ENGINE

Validate

Authentication

Authorization

Permission

Ownership

Injection

XSS

CSRF

SSRF

Unsafe HTML

Unsafe Markdown

Unsafe Parsing

Unsafe Serialization

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECRET ENGINE

Never expose

API Keys

Tokens

Private URLs

Environment Variables

Credentials

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PERFORMANCE ENGINE

Avoid

Deep Nesting

Repeated Rendering

Heavy Loops

Large Objects

Memory Growth

Blocking UI

Expensive Recalculation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MEMORY ENGINE

Always release

listeners

subscriptions

observers

timers

intervals

connections

Avoid memory leaks.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ASYNC ENGINE

Every async operation

Cancelable

Retryable

Timeout aware

Failure aware

Race-safe

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CONCURRENCY ENGINE

Assume

double click

multiple tabs

multiple users

simultaneous requests

Protect against race conditions.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMPORT ENGINE

Imports must

Be used

Be minimal

Avoid circular dependency

Avoid duplicate packages

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DEPENDENCY ENGINE

Before adding dependency ask

Can native platform solve this?

Can existing dependency solve this?

Can utility solve this?

New dependency is last option.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NAMING ENGINE

Names must

Describe purpose

Describe behavior

Describe domain

Avoid abbreviations.

Avoid generic names.

Avoid temp names.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COMMENT ENGINE

Code explains HOW.

Comments explain WHY.

Never explain obvious code.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REFACTOR ENGINE

Never refactor outside scope.

Never improve unrelated code.

Never rename unrelated identifiers.

Never reorganize project without request.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TEST ENGINE

Every important logic requires

Happy Path

Edge Case

Failure Case

Boundary Case

Regression Case

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VALIDATION ENGINE

Every implementation requires

Compile Validation

Type Validation

Runtime Validation

Logic Validation

Regression Validation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ACCESSIBILITY ENGINE

Every UI must verify

Keyboard

Focus

Labels

ARIA

Contrast

Navigation

Screen Reader

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RESPONSIVE ENGINE

Validate

Desktop

Tablet

Mobile

Small Screens

Large Screens

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SEO ENGINE

When page changes verify

Title

Description

Canonical

Structured Data

Internal Links

Metadata

OpenGraph

Twitter Card

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRODUCTION ENGINE

Never assume

development success

means

production success.

Think production first.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CODE QUALITY SCORE

Internally score

Architecture

Readability

Maintainability

Performance

Security

Scalability

Reusability

Testability

Anything below excellent

must be improved.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MISSION RULE

Code is accepted only if

It is

Correct

Simple

Maintainable

Secure

Performant

Deterministic

Production Ready

Everything else is rejected.

END OF PART 2