# Implementation Plan: Inline Data Editing

**Branch**: `003-inline-data-editing` | **Date**: 2026-02-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-inline-data-editing/spec.md`

## Summary

Add inline cell editing to the data preview grid, allowing users to double-click a cell, modify its value, and persist the change to the SQLite database file immediately. The extension migrates from sql.js (in-memory only) to node-sqlite3-wasm (direct file I/O via SQLite VFS), enabling incremental writes without full-file rewrites. SQLite's native file locking handles concurrent access. Error handling surfaces constraint violations (NOT NULL, UNIQUE, FK) inline. A "Set NULL" mechanism distinguishes null from empty string.

## Technical Context

**Language/Version**: TypeScript 5.x (same as features 001/002)
**Primary Dependencies**: node-sqlite3-wasm (replaces sql.js — WASM-based SQLite with direct file I/O), React 18 (already installed)
**Storage**: SQLite via node-sqlite3-wasm VFS (direct file access, native journaling and locking)
**Testing**: Manual testing via test.db (consistent with existing features)
**Target Platform**: VS Code 1.85+ extension (Node.js host + browser webview)
**Project Type**: Single project (VS Code extension)
**Performance Goals**: Cell edit → saved result visible in <200ms (constitution UX requirement); constraint errors in <1s (SC-003)
**Constraints**: Parameterized queries only (constitution III); extension must not block VS Code UI thread
**Scale/Scope**: Small-to-medium SQLite databases (development/testing use case per spec assumptions)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Check

| Principle | Status | Evidence |
|-----------|--------|----------|
| **I. Simplicity (YAGNI)** | PASS | One dependency swapped (sql.js → node-sqlite3-wasm), not added. No abstractions — direct db calls. No batch mode, undo/redo, or extensibility points. |
| **II. User Experience First** | PASS | Double-click is standard grid editing convention. Inline errors describe what user can do. Edit feedback <200ms. Follows VS Code theming. |
| **III. Secure by Default** | PASS | Parameterized queries via `db.run(sql, params)`. No string concatenation for values. Identifier names escaped via double-quoting. |
| **Quality Standards** | PASS | Direct file I/O — no full-file rewrite. Graceful error handling for constraint violations, read-only files, and SQLITE_BUSY. No UI thread blocking. |
| **Development Workflow** | PASS | Feature branch `003-inline-data-editing`. Spec approved before implementation. |

### Post-Design Check

| Principle | Status | Evidence |
|-----------|--------|----------|
| **I. Simplicity** | PASS | 5 files modified, 0 new files. sql.js removed, node-sqlite3-wasm added (net zero dependency change). CellEdit state is local to DataPreview component. |
| **II. UX First** | PASS | Edit mode is visually distinct. Enter/Escape/blur all have clear behaviors. Error messages are actionable. NULL mechanism is explicit. Edit blocked when pending external reload. |
| **III. Secure by Default** | PASS | All UPDATE queries use parameterized bindings. Table/column identifiers use safe double-quote escaping. No credentials involved. |
| **Quality Standards** | PASS | SQLite handles file locking and journaling natively. Self-change flag on watcher prevents false reload notifications. |

## Project Structure

### Documentation (this feature)

```text
specs/003-inline-data-editing/
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
├── schemaProvider.ts         # MODIFY: CustomEditorProvider, update-cell handler, open by path, self-change flag
├── sqliteService.ts          # MODIFY: Migrate to node-sqlite3-wasm, add updateCell(), open by file path
├── types.ts                  # MODIFY: New message types, extended DataPage
└── webview/
    ├── App.tsx               # No changes needed
    ├── SchemaTree.tsx         # No changes needed
    ├── DataPreview.tsx        # MODIFY: Edit state, double-click, input, error display, Set NULL
    ├── ErDiagram.tsx          # No changes needed
    ├── TableNode.tsx          # No changes needed
    ├── index.tsx              # No changes needed
    └── vscodeApi.ts           # No changes needed

esbuild.mjs                   # MODIFY: Remove sql-wasm.wasm copy step, configure node-sqlite3-wasm bundling
package.json                   # MODIFY: Replace sql.js with node-sqlite3-wasm
```

**Structure Decision**: Existing single-project VS Code extension structure is preserved. All changes are modifications to existing files. No new files, components, or abstractions needed.

## Implementation Phases

### Phase A: Migrate sql.js → node-sqlite3-wasm (read-only checkpoint)

Replace the SQLite library and adapt all existing read-only logic (schema loading, data pagination, sorting, ER diagram, file watcher). **All existing functionality must work identically before proceeding.** This is a verification gate — the build must succeed and the extension must pass manual smoke testing of the current feature set:

- Schema tree loads and displays tables, columns, indexes
- Search/filter works
- Data preview with pagination and sorting works
- ER diagram renders correctly
- File watcher detects external changes
- Read-only/invalid file error handling works

### Phase B: Add inline editing (write path)

With the library migration verified, add the editing functionality: update-cell message handling, parameterized UPDATE queries, edit UI in DataPreview (double-click, input, Enter/Escape/blur, inline errors, Set NULL), and the `isWritingBack` flag on the file watcher.
