# Research: SQL Database Visualizer

**Branch**: `001-sql-db-visualizer` | **Date**: 2026-02-11

## Decision 1: SQLite Access Library

**Decision**: Use `sql.js` (SQLite compiled to WebAssembly).

**Rationale**: sql.js has zero native dependencies, works identically
on all platforms from a single .vsix package, and avoids the Electron
ABI mismatch problem that plagues `better-sqlite3` in VS Code extensions.
The most popular VS Code SQLite extension (`vscode-sqlite` by alexcvzz)
switched from `better-sqlite3` to `sql.js` specifically to resolve
cross-platform native module issues.

**Performance**: sql.js is 2-5x slower than `better-sqlite3` in raw
benchmarks, but for this read-only use case (schema PRAGMAs return in
microseconds, paginated queries with LIMIT 50 complete in <100ms),
the difference is negligible. All performance targets from the spec
(SC-001 through SC-005) are achievable.

**Bundle size**: ~1.3 MB (Wasm binary + JS wrapper). Fits comfortably
within the 5 MB constitution budget.

**Alternatives considered**:
- `better-sqlite3`: Native C addon. Fastest option but requires
  per-platform prebuilt binaries, Electron rebuild on every VS Code
  update, and 2-3 MB per platform (12-18 MB for all). Rejected for
  maintenance burden and bundle size.
- `@sqlite.org/sqlite-wasm`: Official SQLite Wasm build. Less mature
  for Node.js/VS Code use than sql.js. Viable future option.
- Separate child process with system Node.js: Avoids Electron ABI
  issue but requires users to have Node.js installed. Violates
  zero-configuration goal.

## Decision 2: ER Diagram Rendering

**Decision**: Use ReactFlow (@xyflow/react) for rendering and
interaction, paired with ELK.js for automatic layout.

**Rationale**: ReactFlow's custom node system renders each table as a
React component — a styled header with columns, types, and PK/FK icons
using standard HTML/CSS. This directly maps to the ER diagram
requirements (acceptance scenario 3: click a table to see details).
ELK.js provides the best-in-class layered layout algorithm with
orthogonal edge routing, purpose-built for ER-style diagrams. ReactFlow
provides built-in pan, zoom, node selection, and a handle/port system
that maps FK edges to specific columns.

**Bundle size**: ~270 KB min+gzip total (ReactFlow ~85 KB + React/
ReactDOM ~42 KB + elkjs ~140 KB). Well within budget.

**Layout performance**: ELK computes layout for 100 nodes in 200-500ms.
Combined with ReactFlow rendering, total is within the 3-second SC-002
target. ELK can run in a Web Worker for non-blocking execution.

**Alternatives considered**:
- D3.js: Too low-level. No graph abstraction, no built-in pan/zoom,
  no layout engine. Would require building a graph renderer from scratch.
  Rejected per Simplicity principle.
- vis-network: Canvas-based rendering makes custom table nodes painful.
  Maintenance status concerning (stale since 2022). Hierarchical layout
  quality degrades at 100+ nodes.
- Cytoscape.js + ELK: Strong fallback option. Avoids React dependency
  but custom node rendering is less ergonomic (requires HTML label
  extension). Would choose this if React is deemed too heavy.
- Mermaid.js: Static rendering only. Cannot provide pan, zoom,
  click-to-select, or right-click context menus required by FR-005.

## Decision 3: VS Code Extension Architecture

**Decision**: Use `CustomReadonlyEditorProvider` for file association,
with a single webview containing all views (schema tree, ER diagram,
data preview).

**Rationale**: `CustomReadonlyEditorProvider` is the correct API for
read-only file association — it avoids implementing save/revert/undo
logic that `CustomEditorProvider` requires. Registration via
`contributes.customEditors` in package.json with `priority: "default"`
makes clicking a .db file immediately open the visualizer.

All views live inside the same webview (React app with view switching)
rather than splitting between a native TreeDataProvider and webview.
This is the simplest architecture — one contribution point, one
communication channel, one React app. The native TreeDataProvider
option was considered but rejected: it adds a second contribution point,
a shared state service, and synchronization logic between tree and
webview for minimal UX gain.

**Key patterns**:
- `postMessage`/`onDidReceiveMessage` with typed `{ type, requestId,
  payload }` messages for extension ↔ webview communication
- `retainContextWhenHidden: true` to preserve webview state when tab
  loses focus
- Track current `WebviewPanel` and dispose previous when a new file
  opens (one-at-a-time constraint)
- `vscode.workspace.createFileSystemWatcher` on the opened file for
  delete/change detection
- Content Security Policy with nonce-based script tags in webview

## Decision 4: Data Grid for Table Preview

**Decision**: Use a plain HTML `<table>` with VS Code CSS custom
properties for theming.

**Rationale**: The spec requires 50 rows per page with column sorting
and pagination. A vanilla HTML table with sorting/pagination handled
via postMessage to the extension host (which re-queries SQLite with
ORDER BY and LIMIT/OFFSET) meets all requirements with zero additional
dependencies. This aligns with the Simplicity constitution principle.

**Alternatives considered**:
- AG Grid Community (~200KB): Overkill for 50-row paginated display.
  Would add if requirements expand to virtual scrolling or inline
  editing.
- @vscode/webview-ui-toolkit `vscode-data-grid`: Provides native VS
  Code styling but lacks built-in sorting and pagination.
