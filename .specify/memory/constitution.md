<!--
  Sync Impact Report
  ==================
  Version change: 1.0.0 → 1.0.1
  Modified principles: Quality Standards (automated test MUST → SHOULD)
  Added sections:
    - Core Principles: Simplicity, User Experience First, Secure by Default
    - Quality Standards
    - Development Workflow
    - Governance
  Removed sections:
    - [SECTION_2_NAME] and [SECTION_3_NAME] placeholders replaced with
      concrete sections
  Templates requiring updates:
    - .specify/templates/plan-template.md ✅ no changes needed
      (Constitution Check section is dynamically populated)
    - .specify/templates/spec-template.md ✅ no changes needed
    - .specify/templates/tasks-template.md ✅ no changes needed
    - .specify/templates/checklist-template.md ✅ no changes needed
  Follow-up TODOs: none
-->

# SDD-POC Constitution

## Core Principles

### I. Simplicity (YAGNI)

- Every feature, abstraction, and dependency MUST justify its existence
  with a concrete, current requirement. Hypothetical future needs are
  not justification.
- Prefer inline code over abstractions until a pattern repeats three or
  more times. Three similar lines are better than a premature helper.
- MUST NOT add configuration options, feature flags, or extensibility
  points unless explicitly required by the current specification.
- When choosing between approaches, the one with fewer moving parts wins
  unless measurable evidence proves otherwise.

**Rationale**: Complexity is the primary risk for a VS Code extension
project. Every unnecessary abstraction increases cognitive load, slows
iteration, and widens the surface area for bugs.

### II. User Experience First

- Every user-facing interaction MUST be designed from the user's
  perspective inside the editor, not from the system's perspective.
- Visual feedback MUST appear within 200ms of a user action; longer
  operations MUST show progress indication.
- Error messages MUST describe what the user can do to fix the problem,
  not just what went wrong internally.
- The extension MUST follow VS Code's UX conventions (command palette,
  sidebar panels, editor tabs, status bar) rather than inventing novel
  interaction patterns.

**Rationale**: A VS Code extension lives inside an editor that users
spend hours in daily. Poor UX means users will ignore or uninstall the
extension regardless of its capabilities.

### III. Secure by Default

- Database connection credentials MUST NOT be stored in plaintext in
  extension state, logs, or telemetry.
- The extension MUST leverage VS Code's built-in SecretStorage API or
  equivalent secure credential management for all sensitive data.
- Connection strings and credentials MUST NOT appear in error messages,
  stack traces, or diagnostic output shown to users or written to logs.
- All user-provided input used in database queries MUST be parameterized;
  string concatenation for query construction is prohibited.

**Rationale**: This extension handles database connections containing
credentials. A single credential leak can compromise production
databases. Security MUST be a default, not an opt-in.

## Quality Standards

- All user-facing features SHOULD have at least one automated test that
  exercises the happy path. When automated testing is disproportionately
  complex (e.g., VS Code webview interactions requiring a full extension
  host), manual smoke testing with a documented test plan in quickstart.md
  is an acceptable alternative.
- Extension MUST activate and load without errors on a clean VS Code
  installation with no other extensions.
- Extension MUST NOT block the VS Code UI thread; all database operations
  and heavy computation MUST run asynchronously.
- Extension MUST handle database connection failures gracefully with
  user-actionable error messages.
- Extension bundle size SHOULD remain under 5 MB to ensure fast
  installation and activation.

## Development Workflow

- Feature branches MUST follow the `NNN-short-name` naming convention
  managed by the Specify toolkit.
- Each feature MUST have a specification (`spec.md`) approved before
  implementation begins.
- Commits MUST be atomic: one logical change per commit with a clear
  message describing why, not just what.
- Dependencies MUST be evaluated against the Simplicity principle before
  addition. Prefer VS Code built-in APIs and Node.js standard library
  over third-party packages when capability is equivalent.

## Governance

- This constitution supersedes all ad-hoc practices. When a development
  decision conflicts with these principles, the constitution wins.
- Amendments require: (1) a written proposal describing the change and
  rationale, (2) an update to this file with version increment, and
  (3) a consistency check across all dependent templates.
- Version follows semantic versioning: MAJOR for principle
  removals/redefinitions, MINOR for new principles or material
  expansions, PATCH for wording clarifications.
- All pull requests MUST be reviewed for compliance with these principles.
  The plan template's Constitution Check section serves as the
  enforcement gate.

**Version**: 1.0.1 | **Ratified**: 2026-02-11 | **Last Amended**: 2026-02-12
