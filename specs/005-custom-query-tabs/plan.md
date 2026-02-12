# Implementation Plan: Custom Query Tabs

**Branch**: `005-custom-query-tabs` | **Date**: 2026-02-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-custom-query-tabs/spec.md`

## Summary

Add a custom SQL query interface to the database viewer. Users can open query tabs, write SQL statements, execute them, and view results in a tabular format. Multiple tabs are supported, each with independent query text and results. All tab state is transient — nothing persists when the viewer closes. Query results are fetched in full and paginated client-side. No new dependencies required.

## Technical Context

**Language/Version**: TypeScript 5.x (same as features 001-004)
**Primary Dependencies**: node-sqlite3-wasm (already installed), React 18 (already installed) — no new dependencies
**Storage**: SQLite via node-sqlite3-wasm VFS (direct file access, same as features 003-004)
**Testing**: Manual testing via test.db (consistent with existing features)
**Target Platform**: VS Code 1.85+ extension (Node.js host + browser webview)
**Project Type**: Single project (VS Code extension)
**Performance Goals**: Query execution + results display in <3s for up to 1000 rows (constitution UX requirement: 200ms feedback)
**Constraints**: Parameterized queries not applicable here (user provides raw SQL); extension must not block VS Code UI thread
**Scale/Scope**: Small-to-medium SQLite databases (same assumptions as features 003-004)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Check

| Principle | Status | Evidence |
|-----------|--------|----------|
| **I. Simplicity (YAGNI)** | PASS | No new dependencies. One new component (QueryView). Plain textarea for input (no code editor). Client-side pagination avoids query manipulation. |
| **II. User Experience First** | PASS | Follows existing view-switching pattern. Standard Ctrl+Enter shortcut. Loading indicator during execution. Error messages displayed inline. |
| **III. Secure by Default** | PASS | No credentials involved (local SQLite files). User-provided SQL is executed directly — this is intentional (the user is the author). No parameterization needed since users deliberately write their own queries. |
| **Quality Standards** | PASS | Manual smoke testing via quickstart.md. No UI thread blocking. Graceful error handling for SQL errors. |
| **Development Workflow** | PASS | Feature branch `005-custom-query-tabs`. Spec approved before implementation. |

### Post-Design Check

| Principle | Status | Evidence |
|-----------|--------|----------|
| **I. Simplicity** | PASS | 4 files modified, 1 new file (QueryView.tsx). One new method in sqliteService. One new message handler in schemaProvider. Tab state is local to QueryView. |
| **II. UX First** | PASS | View switching with header button. Tab bar with labels and close buttons. Ctrl+Enter to execute. Loading spinner. Error messages inline. Results consistent with data preview. |
| **III. Secure by Default** | PASS | No credential handling. Raw SQL execution is the explicit purpose of this feature — the user is the query author. isWritingBack flag prevents false notifications on write queries. |
| **Quality Standards** | PASS | Same isWritingBack pattern for write queries. Client-side pagination avoids re-execution overhead. |

## Project Structure

### Documentation (this feature)

```text
specs/005-custom-query-tabs/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── messages.md      # Message contract definitions
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── extension.ts              # No changes needed
├── schemaProvider.ts         # MODIFY: execute-query handler, isWritingBack for write queries
├── sqliteService.ts          # MODIFY: add executeQuery() method
├── types.ts                  # MODIFY: new message types (ExecuteQueryMessage, QueryResultMessage), add to unions
└── webview/
    ├── App.tsx               # MODIFY: add 'query' view mode, header button, render QueryView
    ├── SchemaTree.tsx        # No changes needed
    ├── DataPreview.tsx       # No changes needed
    ├── QueryView.tsx         # NEW: query tab management, textarea, results display
    ├── ErDiagram.tsx         # No changes needed
    ├── TableNode.tsx         # No changes needed
    ├── index.tsx             # No changes needed
    └── vscodeApi.ts          # No changes needed

esbuild.mjs                   # No changes needed
package.json                   # No changes needed
```

**Structure Decision**: Existing single-project VS Code extension structure is preserved. One new file (`QueryView.tsx`) is justified because it encapsulates all query tab logic — embedding it in App.tsx would make that file too large. All other changes are modifications to existing files.

## Implementation Phases

### Phase A: Single query execution (US1 — MVP)

Add execute-query message flow, sqliteService.executeQuery() method, and a basic QueryView with a single tab. This delivers the core query execution capability.

- New message types in types.ts
- executeQuery() in sqliteService (detect SELECT vs DML/DDL, return appropriate result)
- execute-query handler in schemaProvider (with isWritingBack for writes)
- QueryView component with textarea, execute button, and results table
- 'query' view mode in App.tsx with header button
- Results displayed using same table styling as DataPreview
- Error display for failed queries
- Loading indicator during execution
- Ctrl+Enter keyboard shortcut

### Phase B: Multiple tabs (US2)

Add tab management to QueryView — tab bar, new tab button, close tab button, independent state per tab.

- Tab bar UI with labels ("Query 1", "Query 2", ...)
- New tab button (+)
- Close button per tab (×)
- Independent query text and results per tab
- Sequential tab numbering
- State preserved when switching between tabs

### Phase C: Results interaction (US3) and polish

Add client-side pagination and sorting to query results. Final styling and edge case handling.

- Client-side pagination (reuse page size of 50 from DataPreview)
- Client-side column sorting (sort the in-memory result set)
- NULL and BLOB value indicators
- Zero-rows empty state
- View switching preservation (query tabs persist across schema/ER/query view switches)
- Final build and validation
