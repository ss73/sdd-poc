# Quickstart: Inline Data Editing

**Feature**: 003-inline-data-editing
**Date**: 2026-02-12

## Prerequisites

- Node.js 18+
- VS Code 1.85+
- Existing extension builds and runs (`npm run build`)

## Dependency Change

Replace sql.js with node-sqlite3-wasm:

```bash
npm uninstall sql.js
npm install node-sqlite3-wasm
```

node-sqlite3-wasm is WASM-based (like sql.js) so no native compilation or `electron-rebuild` is needed. The key difference: it opens database files directly by path and writes through to disk via SQLite's native VFS, rather than operating on an in-memory buffer.

## Files to Modify

| File | Change |
|------|--------|
| `package.json` | Replace `sql.js` with `node-sqlite3-wasm` |
| `esbuild.mjs` | Remove `sql-wasm.wasm` copy step, configure node-sqlite3-wasm bundling |
| `src/types.ts` | Add `UpdateCellMessage`, `UpdateResultMessage` types. Extend `DataPage` with PK metadata and editability info. |
| `src/sqliteService.ts` | Migrate from sql.js to node-sqlite3-wasm. Change `openDatabase(buffer)` to `openDatabase(filePath)`. Adapt query methods (`db.exec()` → `db.all()`). Add `updateCell()` method with parameterized queries. |
| `src/schemaProvider.ts` | Change from `CustomReadonlyEditorProvider` to `CustomEditorProvider`. Pass `uri.fsPath` instead of file buffer. Add `update-cell` message handler. Add `isWritingBack` flag for file watcher. |
| `src/webview/DataPreview.tsx` | Add edit state, double-click handler, inline `<input>`, Enter/Escape/blur handlers, inline error display, "Set NULL" button for nullable columns. |

## No New Files Required

All changes are modifications to existing files. No new components, services, or utilities needed.

## Build & Test

```bash
npm run build        # bundle extension + webview
npm run watch        # rebuild on changes during development
```

Manual test flow:
1. Open `test.db` in VS Code
2. Click a table to preview data
3. Double-click a cell → verify it enters edit mode
4. Change value, press Enter → verify value persists after reload
5. Press Escape → verify edit is cancelled
6. Try violating a constraint → verify inline error appears
7. Test "Set NULL" on a nullable column
8. Verify read-only .db files prevent editing
9. Modify the .db file externally → verify editing is blocked until reload

## Key Technical Notes

- **Direct file I/O**: node-sqlite3-wasm writes to the file via SQLite's VFS — no `export()` or full-file rewrite
- **Concurrent access**: SQLite's built-in file locking handles concurrent access. `SQLITE_BUSY` errors are surfaced as inline error messages.
- **Parameterized queries**: Use `db.run(sql, params)` for all user values (constitution requirement)
- **Identifier escaping**: Table/column names use double-quote escaping (`"name"` → `""name""`)
- **Row identification**: PK columns from `PRAGMA table_info()`, or `rowid` as fallback
- **File watcher**: `isWritingBack` flag prevents extension from reacting to its own writes
