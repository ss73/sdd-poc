# Implementation Plan: SQL Database Visualizer

**Branch**: `001-sql-db-visualizer` | **Date**: 2026-02-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-sql-db-visualizer/spec.md`

## Summary

Build a VS Code extension that lets developers click a SQLite database
file (.db, .sqlite, .sqlite3) in the file explorer to instantly browse
its schema, view an interactive ER diagram, and preview table data —
all with zero configuration. Uses sql.js (WebAssembly) for cross-platform
SQLite access with no native dependencies, ReactFlow + ELK.js for
interactive ER diagram rendering with automatic layout, and a single
custom editor webview as the unified UI.

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: sql.js (SQLite Wasm), @xyflow/react (ER rendering), elkjs (graph layout), React 18 (webview UI)
**Storage**: SQLite files (read-only, user-provided via file explorer)
**Testing**: @vscode/test-electron + Mocha (integration), Vitest (unit)
**Target Platform**: VS Code (macOS, Linux, Windows) — single .vsix
**Project Type**: VS Code extension (single project)
**Performance Goals**: <3s schema load (SC-001), <200ms search (SC-003), <2s data preview (SC-005), <3s ER render (SC-002)
**Constraints**: <5 MB bundle, no UI thread blocking, read-only database access
**Scale/Scope**: Up to 500 tables, 1M rows per table, single database at a time

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Simplicity (YAGNI) — PASS

| Rule | Status | Evidence |
|------|--------|----------|
| Every dependency justified | ✅ | sql.js → FR-010 (SQLite access). ReactFlow → FR-004/FR-005 (ER diagram). elkjs → FR-005 (auto-layout). React → required by ReactFlow. Total: 4 key deps. |
| No premature abstractions | ✅ | No database adapter pattern (SQLite only). No connection profiles (file-based). No plugin system. |
| No unnecessary config | ✅ | Zero-config: click file to open. No settings required. |
| Fewer moving parts | ✅ | Single webview for all views. One communication channel (postMessage). One SQLite service. |

### II. User Experience First — PASS

| Rule | Status | Evidence |
|------|--------|----------|
| 200ms visual feedback | ✅ | Search filtering is in-memory on pre-loaded schema (<1ms). File open shows loading indicator immediately. |
| Progress indication | ✅ | ELK layout (200-500ms) shows spinner. Large file reads show progress bar. |
| Actionable error messages | ✅ | FR-009 covers all file error cases with user guidance. |
| VS Code conventions | ✅ | Custom editor for file association. Command palette for ER diagram. Standard webview patterns. |

### III. Secure by Default — PASS

| Rule | Status | Evidence |
|------|--------|----------|
| No plaintext credentials | ✅ N/A | SQLite is file-based. No credentials involved. |
| Parameterized queries | ✅ | All queries use SQLite PRAGMAs or parameterized statements. Table/column names are quoted identifiers from schema metadata, not user input. |
| No credentials in errors | ✅ N/A | No credentials exist to leak. |
| Content Security Policy | ✅ | Webview uses nonce-based CSP. No inline scripts. |

### Quality Standards — PASS

| Rule | Status | Evidence |
|------|--------|----------|
| Automated tests per feature | ✅ | Each user story has integration tests via @vscode/test-electron. |
| Clean activation | ✅ | sql.js Wasm init is async (~50-100ms). No sync work on activate. |
| No UI thread blocking | ✅ | Extension host is separate process. sql.js queries <100ms. ELK layout can use Web Worker. |
| <5 MB bundle | ✅ | sql.js ~1.3 MB + ReactFlow+React+ELK ~800 KB uncompressed + extension code ~200 KB ≈ ~2.3 MB total. |

## Project Structure

### Documentation (this feature)

```text
specs/001-sql-db-visualizer/
├── plan.md              # This file
├── research.md          # Phase 0 output (technology decisions)
├── data-model.md        # Phase 1 output (entities and schema)
├── quickstart.md        # Phase 1 output (developer setup)
├── contracts/           # Phase 1 output (message protocols)
│   └── messages.md      # Extension ↔ webview message contracts
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── extension.ts              # Entry point: activate/deactivate
├── sqliteService.ts          # sql.js wrapper: open file, schema queries, data queries
├── schemaProvider.ts         # CustomReadonlyEditorProvider implementation
├── types.ts                  # Shared types (schema, messages, etc.)
└── webview/
    ├── index.tsx             # Webview entry point (React root)
    ├── App.tsx               # View router (schema tree / ER diagram / data preview)
    ├── SchemaTree.tsx         # Schema tree view component
    ├── ErDiagram.tsx          # ReactFlow ER diagram component
    ├── TableNode.tsx          # Custom ReactFlow node for table boxes
    ├── DataPreview.tsx        # Paginated data grid component
    └── vscodeApi.ts           # postMessage wrapper and typed message handlers

tests/
├── unit/
│   └── sqliteService.test.ts  # sql.js schema/data query tests
└── integration/
    └── extension.test.ts      # VS Code extension activation and file open tests
```

**Structure Decision**: Single VS Code extension project. The `src/webview/`
directory contains React source that is bundled separately (esbuild) for
the webview context. The extension host code (`src/*.ts` excluding webview/)
is bundled for the Node.js extension host context. Two esbuild entry points,
one output directory.

## Complexity Tracking

> No constitution violations. All design choices use the simplest
> available approach for each requirement.
