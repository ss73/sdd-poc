# Implementation Plan: Export to CSV for Result Sets

**Branch**: `006-export-csv` | **Date**: 2026-02-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-export-csv/spec.md`

## Summary

Add CSV export capability for both query tab results and table preview data. The webview gets an "Export to CSV" button in both panels; clicking it sends a message to the extension host, which handles the save dialog, data fetching (for table preview), RFC 4180 CSV formatting, and file writing with progress/cancellation support.

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: node-sqlite3-wasm (already installed), React 18 (already installed) — no new dependencies
**Storage**: SQLite via node-sqlite3-wasm VFS (direct file access, same as features 003-005)
**Testing**: No test framework installed; manual smoke testing per constitution allowance (quickstart.md)
**Target Platform**: VS Code extension (desktop, all platforms)
**Project Type**: VS Code extension (extension host + React webview)
**Performance Goals**: <5s for 10,000 rows (SC-001)
**Constraints**: Must not block VS Code UI thread (constitution); no new dependencies (constitution Simplicity)
**Scale/Scope**: Single database files, typical developer use (up to ~100k rows)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-research gate (pass)

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Simplicity (YAGNI)** | PASS | Zero new dependencies. CSV formatting is ~20 lines of pure logic. One new file (`csvFormatter.ts`) justified by testability — not a premature abstraction. |
| **II. User Experience First** | PASS | Export button follows existing `header-btn` toolbar pattern. Native OS save dialog. `withProgress` notification for long exports. Success/error messages with actionable text. |
| **III. Secure by Default** | PASS | No credentials involved. No user input used in queries (table exports use parameterized table names; query exports use data already in memory). |
| **Quality Standards** | PASS | Manual smoke test plan in quickstart.md (8 scenarios). CSV formatter is a pure function suitable for unit testing if a test framework is added later. |
| **Development Workflow** | PASS | Feature branch `006-export-csv` follows convention. Spec approved. |

### Post-design gate (pass)

| Artifact | Simplicity check | Notes |
|----------|-------------------|-------|
| `csvFormatter.ts` | PASS | Single pure function, no dependencies, no configuration |
| `contracts/csv-export-messages.ts` | PASS | 2 message types following existing codebase pattern |
| `data-model.md` | PASS | No persistent entities — all transient data flows |
| New `getAllTableRows()` method | PASS | Single SELECT query, mirrors existing `getRows()` without pagination overhead |

## Project Structure

### Documentation (this feature)

```text
specs/006-export-csv/
├── plan.md              # This file
├── research.md          # Phase 0: technology decisions
├── data-model.md        # Phase 1: logical data structures
├── quickstart.md        # Phase 1: manual smoke test plan
├── contracts/
│   └── csv-export-messages.ts  # Phase 1: message type contracts
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── extension.ts              # (no changes expected)
├── schemaProvider.ts          # Add export-csv message handler
├── sqliteService.ts           # Add getAllTableRows() method
├── csvFormatter.ts            # NEW: pure formatCsv() function
├── types.ts                   # Add ExportCsvMessage + ExportCsvResultMessage types
└── webview/
    ├── App.tsx                # (no changes expected)
    ├── DataPreview.tsx        # Add "Export to CSV" button in toolbar
    ├── QueryView.tsx          # Add "Export to CSV" button per tab
    ├── vscodeApi.ts           # (no changes expected)
    └── ...                    # (remaining files unchanged)
```

**Structure Decision**: Single project structure (extension host + bundled webview). No new directories needed — the feature adds one new file (`csvFormatter.ts`) and modifies four existing files.

## Complexity Tracking

No constitution violations — table is intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *(none)* | | |
