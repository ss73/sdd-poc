# sdd-poc Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-11

## Active Technologies
- TypeScript 5.x (same as feature 001) + React 18 (already installed, no new deps) (002-split-view-preview)
- N/A (no changes to data layer) (002-split-view-preview)
- TypeScript 5.x (same as features 001/002) + sql.js 1.11.0 (already installed — supports `db.run()`, `db.export()`), React 18 (already installed) (003-inline-data-editing)
- SQLite via sql.js WASM (in-memory, written back to `.db` file on disk via `vscode.workspace.fs`) (003-inline-data-editing)
- TypeScript 5.x (same as features 001/002) + node-sqlite3-wasm (replaces sql.js — WASM-based SQLite with direct file I/O), React 18 (already installed) (003-inline-data-editing)
- SQLite via node-sqlite3-wasm VFS (direct file access, native journaling and locking) (003-inline-data-editing)
- TypeScript 5.x (same as features 001-003) + node-sqlite3-wasm (already installed), React 18 (already installed) — no new dependencies (004-row-insert-delete)
- SQLite via node-sqlite3-wasm VFS (direct file access, same as feature 003) (004-row-insert-delete)

- TypeScript 5.x + sql.js (SQLite Wasm), @xyflow/react (ER rendering), elkjs (graph layout), React 18 (webview UI) (001-sql-db-visualizer)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.x: Follow standard conventions

## Recent Changes
- 004-row-insert-delete: Added TypeScript 5.x (same as features 001-003) + node-sqlite3-wasm (already installed), React 18 (already installed) — no new dependencies
- 003-inline-data-editing: Added TypeScript 5.x (same as features 001/002) + node-sqlite3-wasm (replaces sql.js — WASM-based SQLite with direct file I/O), React 18 (already installed)
- 003-inline-data-editing: Added TypeScript 5.x (same as features 001/002) + sql.js 1.11.0 (already installed — supports `db.run()`, `db.export()`), React 18 (already installed)


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
