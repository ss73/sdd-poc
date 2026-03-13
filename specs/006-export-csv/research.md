# Research: Export to CSV for Result Sets

## VS Code Save Dialog

**Decision**: Use `vscode.window.showSaveDialog({ defaultUri, filters: { 'CSV files': ['csv'], 'All files': ['*'] } })`  
**Rationale**: Returns a `Uri | undefined` — `undefined` means the user cancelled. The native OS dialog handles overwrite confirmation automatically on all platforms (macOS, Windows, Linux). No custom dialog required, satisfying FR-004 and the clarification from the spec.  
**Alternatives considered**: Custom VS Code QuickPick modal — rejected (non-native, worse UX, more code).

---

## File Writing API

**Decision**: `vscode.workspace.fs.writeFile(uri, Buffer.from(csvContent, 'utf-8'))` for exports up to ~100k rows. For very large exports, write via Node.js `fs.writeFile` synchronously inside the progress callback (extension host has Node.js access).  
**Rationale**: `vscode.workspace.fs` is the idiomatic VS Code API. It accepts a `Uri` (compatible with the `showSaveDialog` return value) and a `Uint8Array`. `Buffer.from(str, 'utf-8')` satisfies the type. No streaming needed for the expected scale (10k–100k rows of text data stays well under memory limits).  
**Partial file cleanup**: Wrap the write in `try/catch/finally`. On error or cancellation, call `vscode.workspace.fs.delete(uri, { useTrash: false })` — this no-ops if the file doesn't exist, so it is safe to call unconditionally.  
**Alternatives considered**: Node.js `fs.createWriteStream` streaming — rejected (adds complexity; not needed at this scale per constitution Simplicity principle).

---

## Progress & Cancellation

**Decision**: `vscode.window.withProgress({ location: ProgressLocation.Notification, title: 'Exporting CSV…', cancellable: true }, async (progress, token) => { … })`  
**Rationale**: Shows a progress toast in the bottom-right corner with a Cancel button. `token.isCancellationRequested` is polled after the CSV string is generated but before (and optionally during) the file write. For single-batch exports (all rows fetched at once), the cancel window is between fetching and writing. For table preview exports that could be very large, we generate CSV in row chunks (e.g., 10k rows per iteration) and check `token.isCancellationRequested` between chunks.  
**Alternatives considered**: `ProgressLocation.Window` (status bar) — rejected (less visible, no cancel button). Custom WebviewPanel progress — rejected (over-engineered).

---

## CSV Formatting (RFC 4180)

**Decision**: Implement a pure `formatCsv(columns: string[], rows: unknown[][]): string` function in `src/csvFormatter.ts`. Rules:
1. Delimiter: comma (`,`)
2. Line ending: CRLF (`\r\n`) throughout
3. Quoting: enclose any field that contains a comma, double-quote, or newline in double-quotes
4. Escaping: replace each `"` inside a quoted field with `""`
5. NULL → empty field (nothing between delimiters)
6. BLOB (ArrayBuffer / Uint8Array) → literal text `(BLOB)`
7. All other values → `String(value)`

**Rationale**: No third-party CSV library needed. The ruleset maps directly to RFC 4180 §2. A pure function is trivially testable and has zero dependencies, satisfying the Simplicity principle.  
**Alternatives considered**: `csv-stringify` npm package — rejected (external dependency, not needed for this scope).

---

## Message Protocol Design

**Decision**: Two new message types in the existing webview ↔ extension postMessage protocol:

- `export-csv` (webview → extension): carries either query-tab data (columns + rows already in webview memory) or a table-preview request (tableName only; extension fetches all rows).
- `export-csv-result` (extension → webview): carries the outcome (`success | error | cancelled`) so the webview can re-enable the button.

**Rationale**: Consistent with the existing request/response pattern in the codebase (e.g., `execute-query` / `query-result`). Keeping the result message allows the webview to show a transient loading state on the export button.  
**Alternatives considered**: Extension-only flow with no result message back — rejected (webview button would have no way to know when export completed or failed).

---

## Table Preview: Full-Table Fetch

**Decision**: Add `getAllTableRows(tableName: string): { columns: string[]; rows: unknown[][] }` to `SqliteService`. Executes `SELECT * FROM "tableName"` with no LIMIT, returns all rows.  
**Rationale**: The existing `getDataPage` method adds pagination and rowid overhead. A simple `SELECT *` is sufficient for export; BLOB column detection reuses the existing column-type logic already present in `getDataPage`.  
**Alternatives considered**: Re-using `getDataPage` in a loop with increasing page offsets — rejected (unnecessarily complex; the single query is simpler and faster).
