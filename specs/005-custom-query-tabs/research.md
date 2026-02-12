# Research: Custom Query Tabs

**Feature**: 005-custom-query-tabs
**Date**: 2026-02-12

## R1: Query Execution Strategy

**Decision**: Use `db.all()` for SELECT queries (returns row objects) and `db.run()` for non-SELECT queries (returns changes count). Detect query type by parsing the first keyword of the trimmed SQL.

**Rationale**: The existing `sqliteService` already uses `db.all()` for all read queries and `db.run()` for writes. The same pattern applies directly to custom queries. `db.all()` returns all result rows in one call, which is simple and sufficient for the expected result sizes. For DML queries, `db.run()` with node-sqlite3-wasm returns a changes property via `db.getRowsModified()`.

**Alternatives considered**:
- Streaming/chunked execution — rejected because SQLite queries on local files are fast enough for the expected scale (small-to-medium databases) and the complexity of streaming would violate YAGNI.
- Using `db.exec()` for multi-statement support — rejected per spec assumption: only one statement per execution.

## R2: Query Result Pagination Strategy

**Decision**: Fetch all result rows from the extension into the webview, then paginate client-side in the React component.

**Rationale**: Custom query results can't easily be re-fetched with LIMIT/OFFSET because the user's query is arbitrary (could contain joins, subqueries, aggregations). Re-running the query with injected pagination clauses would be fragile and could change semantics. For the expected scale (small-to-medium databases), fetching all rows and paginating in the client is simple and avoids query manipulation.

**Alternatives considered**:
- Wrapping user query in `SELECT * FROM ({user_query}) LIMIT ? OFFSET ?` — rejected because it requires re-executing the query on each page change (slow for expensive queries) and could fail with certain SQL constructs.
- No pagination (scrollable table only) — rejected because very large result sets would cause webview performance issues.

## R3: UI Integration — Where Query Tabs Live

**Decision**: Add a "Query" button to the header actions (alongside "ER Diagram" and "Schema Tree"). Clicking it opens a query view that replaces the content area. Query tabs are managed within this query view as a tab bar above the editor/results layout. The schema tree and data preview continue to work as before — the user switches between "Schema", "ER Diagram", and "Query" views.

**Rationale**: This follows the existing view-switching pattern (schema ↔ ER diagram) and keeps the query feature self-contained in its own view. It avoids complexity of embedding query tabs within the split layout or alongside data preview tabs. The user explicitly switches to "query mode" when they want to write SQL.

**Alternatives considered**:
- Adding query tabs alongside the data preview in the split pane — rejected because it conflates two different interaction modes (browsing vs. querying) and makes the tab management complex.
- Opening queries in a separate VS Code editor tab — rejected because the webview can't easily communicate with a separate editor, and the user wants queries scoped to the current database viewer.

## R4: Query Text Input

**Decision**: Use a plain HTML `<textarea>` for query input. No syntax highlighting or code completion.

**Rationale**: The spec explicitly states syntax highlighting is out of scope. A textarea is the simplest input that supports multi-line SQL. It matches the YAGNI principle — adding a code editor (CodeMirror, Monaco) would be a significant new dependency with no current requirement. The textarea can be enhanced later if needed.

**Alternatives considered**:
- Embedding Monaco editor (VS Code's own editor) — rejected because it's a massive dependency (~5MB), complex to integrate in a webview, and not required by the spec.
- Using a `contenteditable` div — rejected because it adds complexity for no benefit over textarea.

## R5: Tab State Management

**Decision**: Store all query tab state (query text, results, errors, pagination) in a single React state array in a new `QueryView` component. Each tab is an object with an `id`, `label`, `query`, and `result`. The active tab index determines which tab is displayed.

**Rationale**: Since tabs are transient (no persistence), React state is the simplest storage mechanism. The state lives in a single component that manages the tab bar and renders the active tab's content. No global state management or context providers needed.

**Alternatives considered**:
- Lifting tab state to App.tsx — rejected because the query state is self-contained and doesn't need to interact with other views.
- Using a separate state management library — rejected per YAGNI.

## R6: Keyboard Shortcut for Execute

**Decision**: Use Ctrl+Enter (Cmd+Enter on Mac) to execute the query. This is the standard convention in database tools (DataGrip, pgAdmin, DBeaver, Azure Data Studio).

**Rationale**: Ctrl+Enter is universally recognized as "execute query" in database tools. It doesn't conflict with VS Code's webview keyboard handling since the textarea will have focus when the user wants to execute.

**Alternatives considered**:
- F5 — rejected because it conflicts with VS Code's "Start Debugging" command.
- Ctrl+Shift+E — rejected because it's less discoverable and not a convention.

## R7: Write Query and isWritingBack

**Decision**: For DML queries (INSERT, UPDATE, DELETE) and DDL queries (CREATE, DROP, ALTER), set the `isWritingBack` flag before execution, just like cell edits and row operations. This prevents false "database changed" notifications from the file watcher.

**Rationale**: Same pattern already proven in features 003 and 004. The file watcher fires when the database file changes, and we need to suppress that notification when the change was caused by the user's own query.

**Alternatives considered**:
- Not setting the flag — rejected because it would cause confusing "database changed" banners after every write query.
