# Implementation Plan: Row Insert and Delete

**Branch**: `004-row-insert-delete` | **Date**: 2026-02-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-row-insert-delete/spec.md`

## Summary

Add row-level insert and delete operations to the data grid. Users can select a row and delete it (with inline confirmation), or add a new row by filling in values using the existing inline cell editing inputs. Both operations use parameterized SQL, the isWritingBack file watcher flag, and the existing constraint error parsing. No new dependencies are required.

## Technical Context

**Language/Version**: TypeScript 5.x (same as features 001-003)
**Primary Dependencies**: node-sqlite3-wasm (already installed), React 18 (already installed) — no new dependencies
**Storage**: SQLite via node-sqlite3-wasm VFS (direct file access, same as feature 003)
**Testing**: Manual testing via test.db (consistent with existing features)
**Target Platform**: VS Code 1.85+ extension (Node.js host + browser webview)
**Project Type**: Single project (VS Code extension)
**Performance Goals**: Delete → grid refresh in <200ms; Insert commit → grid refresh in <200ms (constitution UX requirement)
**Constraints**: Parameterized queries only (constitution III); extension must not block VS Code UI thread
**Scale/Scope**: Small-to-medium SQLite databases (same assumptions as feature 003)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Check

| Principle | Status | Evidence |
|-----------|--------|----------|
| **I. Simplicity (YAGNI)** | PASS | No new dependencies. Reuses existing cell edit inputs for row insertion. Delete and insert are two methods added to sqliteService. No abstractions — direct db calls. |
| **II. User Experience First** | PASS | Row selection via click is standard grid convention. Inline confirmation for delete (no modal). Insert reuses familiar cell editing. All feedback <200ms. |
| **III. Secure by Default** | PASS | Parameterized queries for INSERT and DELETE. Same escapeId() identifier quoting. No credentials involved. |
| **Quality Standards** | PASS | Manual smoke testing via quickstart.md. No UI thread blocking. Graceful error handling for constraint violations. |
| **Development Workflow** | PASS | Feature branch `004-row-insert-delete`. Spec approved before implementation. |

### Post-Design Check

| Principle | Status | Evidence |
|-----------|--------|----------|
| **I. Simplicity** | PASS | 4 files modified, 0 new files. Two new methods in sqliteService. Two new message handlers in schemaProvider. NewRow state is local to DataPreview. |
| **II. UX First** | PASS | Row click to select, inline delete confirmation, toolbar buttons for actions. Disabled states for read-only/changed. Error messages are actionable. |
| **III. Secure by Default** | PASS | All INSERT/DELETE queries use parameterized bindings. Table/column identifiers use safe double-quote escaping. |
| **Quality Standards** | PASS | Same isWritingBack pattern prevents false reload notifications. Page re-fetch after operations ensures data consistency. |

## Project Structure

### Documentation (this feature)

```text
specs/004-row-insert-delete/
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
├── schemaProvider.ts         # MODIFY: insert-row and delete-row handlers, isWritingBack, parseConstraintError
├── sqliteService.ts          # MODIFY: add insertRow(), deleteRow() methods
├── types.ts                  # MODIFY: new message types (DeleteRowMessage, InsertRowMessage, results), add to unions
└── webview/
    ├── App.tsx               # No changes needed (databaseChanged already passed to DataPreview)
    ├── SchemaTree.tsx         # No changes needed
    ├── DataPreview.tsx        # MODIFY: row selection, delete confirmation, new row composition, toolbar buttons
    ├── ErDiagram.tsx          # No changes needed
    ├── TableNode.tsx          # No changes needed
    ├── index.tsx              # No changes needed
    └── vscodeApi.ts           # No changes needed

esbuild.mjs                   # No changes needed
package.json                   # No changes needed
```

**Structure Decision**: Existing single-project VS Code extension structure is preserved. All changes are modifications to existing files. No new files, components, or abstractions needed.

## Implementation Phases

### Phase A: Delete row (US1 — MVP)

Add row selection state, delete confirmation UI, delete-row message handling, and the sqliteService.deleteRow() method. This is the simplest path to a working row-level operation.

- Row click → selection highlight
- Delete button in toolbar (disabled when no selection, read-only, or databaseChanged)
- Inline confirmation bar
- Parameterized DELETE query
- Re-fetch page after success
- Handle last-row-on-page edge case

### Phase B: Insert row (US2)

Add new row composition state, insert toolbar button, inline cell inputs for the new row, commit/cancel flow, and the sqliteService.insertRow() method.

- Add Row button in toolbar (disabled when read-only, databaseChanged, or no editable columns)
- Transient row at bottom of grid with inline inputs
- Auto-increment PK columns show "(auto)" and are not editable
- Save button commits all values as a single INSERT
- Cancel button discards the transient row (with confirmation if values entered)
- Re-fetch page after success

### Phase C: Error handling and polish (US3)

Add constraint error messages for delete failures (FK violations, SQLITE_BUSY), handle edge cases.

- Reuse existing parseConstraintError() for delete errors
- Add delete-specific error messages where needed
- Handle insert constraint errors (already covered by existing cell edit error display)
- Final build and validation
