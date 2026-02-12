# Research: Inline Data Editing

**Feature**: 003-inline-data-editing
**Date**: 2026-02-12

## R1: SQLite Library for Read-Write File Access

**Decision**: Replace sql.js with [node-sqlite3-wasm](https://github.com/tndrle/node-sqlite3-wasm) for direct file-based read-write access.

**Rationale**: sql.js operates entirely in memory — the database is loaded as a `Uint8Array`, queries run against the in-memory copy, and persisting changes requires exporting the *entire* database and overwriting the file. This creates two serious problems for an editing feature:

1. **Write amplification**: Every single-cell edit rewrites the entire database file, which becomes blocking for larger databases.
2. **Concurrent access risk**: The full-file overwrite silently destroys any changes made by external processes between load and write-back.

node-sqlite3-wasm solves both problems by implementing a custom SQLite VFS (Virtual File System) that maps SQLite's file I/O directly to Node.js `fs`. This means:

- SQLite's native journaling (WAL or rollback) handles incremental writes — only changed pages are written, not the entire file.
- SQLite's built-in file locking handles concurrent access — no manual mtime checks or write-back guards needed.
- No `export()` / full-rewrite cycle. `db.run("UPDATE ...")` writes through to disk via SQLite's normal I/O path.
- Cross-platform without native compilation (WASM, like sql.js).

**API compatibility**: The API is similar to sql.js but closer to better-sqlite3's synchronous style:

```typescript
const db = new Database("path/to/file.db");              // opens file directly
db.run("UPDATE t SET c = ? WHERE id = ?", [value, id]);  // writes to file
const rows = db.all("SELECT * FROM t WHERE id = ?", id); // reads from file
db.close();                                                // releases resources
```

**Alternatives considered**:
- **sql.js (current)** — rejected for editing because of full-file rewrite on every save and concurrent access risk. Remains a fine choice for read-only viewing, but the editing feature demands file-level I/O.
- **better-sqlite3** — best performance (native C bindings), but [persistent NODE_MODULE_VERSION conflicts](https://github.com/WiseLibs/better-sqlite3/issues/1194) with VS Code's Electron runtime. Requires `electron-rebuild` per VS Code version and platform-specific prebuilt binaries. Too fragile to maintain.
- **@vscode/sqlite3** — Microsoft's fork with Electron-compatible prebuilts, but async callback-based API and less actively maintained.

## R2: Editor Provider Type

**Decision**: Change from `CustomReadonlyEditorProvider` to `CustomEditorProvider`.

**Rationale**: VS Code's `CustomReadonlyEditorProvider` does not support document modification signaling. `CustomEditorProvider` adds the `saveCustomDocument()` and `revertCustomDocument()` lifecycle hooks needed for write operations. However, since we write immediately on each cell edit (not batched), these hooks can be minimal — the document is always "saved."

**Alternatives considered**:
- Keeping `CustomReadonlyEditorProvider` and writing to disk outside the editor lifecycle — rejected because it bypasses VS Code's dirty document tracking and could confuse users expecting standard editor behavior.
- Implementing full undo/redo via `CustomEditorProvider` edit tracking — rejected per YAGNI (constitution principle I). Immediate single-cell commits are sufficient for the current spec.

## R3: Row Identification Strategy

**Decision**: Use primary key columns for the WHERE clause. Fall back to SQLite `rowid` for tables without an explicit primary key. Disable editing for WITHOUT ROWID tables that lack a primary key.

**Rationale**: SQLite guarantees every table has a `rowid` (an implicit integer primary key) unless created with `WITHOUT ROWID`. The existing `sqliteService.getTableInfo()` already queries `PRAGMA table_info()` which returns the `pk` flag for each column, so primary key detection is already available.

**Alternatives considered**:
- Using the row's page offset/index as identifier — rejected because it's fragile (changes on sort/filter) and could target the wrong row.
- Requiring all tables to have an explicit PK — rejected because many SQLite databases in practice rely on implicit rowid.

## R4: Parameterized Queries for Correctness

**Decision**: Use parameterized queries via `db.run(sql, params)` for user-provided cell values. Use identifier quoting (double-quote escaping) for table and column names.

**Rationale**: Since the extension runs locally (the user is editing their own database), SQL injection is not a meaningful security threat. However, parameterized queries are the correct approach for **data correctness** — values containing single quotes, backslashes, or other SQL-special characters would silently break or corrupt string-concatenated queries. Parameterized bindings handle all escaping automatically and are also the most concise API path in node-sqlite3-wasm:

```typescript
db.run("UPDATE t SET c = ? WHERE id = ?", [newValue, pkValue]);
```

Table and column names cannot be parameterized in SQL, so they must be escaped by doubling internal double-quotes and wrapping in double-quotes.

**Alternatives considered**:
- String concatenation with manual escaping — rejected because it's more code, error-prone with special characters, and offers no advantage over the parameterized API.

## R5: File Watcher Behavior with Direct File Access

**Decision**: Keep the existing file watcher. Since node-sqlite3-wasm writes directly to the file, the watcher will fire on extension-initiated edits. Use a simple `isWritingBack` flag to suppress false "externally changed" notifications after the extension's own writes.

**Rationale**: The `FileSystemWatcher` cannot distinguish who modified the file — it fires for all changes. When `db.run("UPDATE ...")` writes through to disk, the watcher would trigger a `database-changed` notification and block editing (per FR-009), even though the change came from the user's own edit. The `isWritingBack` flag is a **UX guard** (not a data safety mechanism) that prevents this false alarm.

Note: The concurrent access and data safety concerns from the earlier sql.js analysis are **eliminated** by switching to node-sqlite3-wasm. SQLite's built-in file locking and journaling handle concurrent access natively. If another process holds a write lock, `db.run()` will throw a `SQLITE_BUSY` error, which we surface as an inline error message.

**Alternatives considered**:
- Removing the file watcher entirely — rejected because external changes (e.g., a migration script updating the database) should still be detected and surfaced to the user.

## R6: Data Refresh After Edit

**Decision**: After a successful `db.run()`, re-fetch the current page of data (same table, page, sort) from the database and send it to the webview.

**Rationale**: Since node-sqlite3-wasm operates directly on the file, the data returned by `db.all()` after an update reflects the committed state. Re-fetching the current page ensures the UI shows the true database state, including any side effects (triggers, default values). This keeps the edit-to-display cycle fast (<200ms per constitution UX requirement).

**Alternatives considered**:
- Optimistic UI update (update the cell in the webview without re-querying) — rejected because it skips database-level validation (triggers, computed columns) and could show stale data.

## R7: Migration Path from sql.js

**Decision**: Replace sql.js with node-sqlite3-wasm in `sqliteService.ts`. Change the database lifecycle from "load buffer into memory" to "open file by path." Remove the WASM file copy step from the build.

**Rationale**: The current `sqliteService.openDatabase(buffer: Uint8Array)` accepts a file buffer read by the extension host. With node-sqlite3-wasm, the service opens the file directly by path: `new Database(filePath)`. This simplifies the extension host (schemaProvider) — it no longer needs to read the file into a buffer and pass it to the service.

Key migration changes:
- `sqliteService.openDatabase(buffer)` → `sqliteService.openDatabase(filePath)` — accepts a file path string instead of a Uint8Array
- `db.exec(query)[0]` → `db.all(query)` — different return format (array of row objects instead of `{columns, values}`)
- Remove `sql-wasm.wasm` copy step from `esbuild.mjs` — node-sqlite3-wasm bundles its own WASM
- `schemaProvider.loadDatabase()` passes `uri.fsPath` instead of reading the file first
- `package.json`: remove `sql.js`, add `node-sqlite3-wasm`

**Alternatives considered**:
- Keeping sql.js for reads and using node-sqlite3-wasm only for writes — rejected because maintaining two SQLite libraries adds complexity with no benefit. node-sqlite3-wasm handles both reads and writes.
