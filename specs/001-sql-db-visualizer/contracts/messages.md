# Message Contracts: Extension ↔ Webview

**Branch**: `001-sql-db-visualizer` | **Date**: 2026-02-11

All communication between the extension host (Node.js) and the webview
(React) uses `postMessage` with typed message objects. Messages follow
the format `{ type: string, requestId?: string, payload: T }`.

## Extension → Webview Messages

### `schema-loaded`

Sent when a database file is successfully opened and its schema is
extracted. This is the primary data payload for the webview.

```typescript
{
  type: 'schema-loaded',
  payload: {
    fileName: string,        // Display name (e.g., "app.db")
    filePath: string,        // Absolute path
    tables: TableInfo[],     // Full schema (see data-model.md)
  }
}
```

### `data-page`

Response to a `request-data` message from the webview.

```typescript
{
  type: 'data-page',
  requestId: string,         // Correlates with the request
  payload: {
    tableName: string,
    columns: string[],
    rows: any[][],           // Row-major data
    page: number,            // 0-indexed
    totalRows: number,
    sortColumn: string | null,
    sortDirection: 'asc' | 'desc' | null,
  }
}
```

### `error`

Sent when an operation fails in the extension host.

```typescript
{
  type: 'error',
  requestId?: string,        // If in response to a request
  payload: {
    message: string,         // User-facing error message
    action?: string,         // Suggested action (e.g., "Check file path")
  }
}
```

### `database-unavailable`

Sent when the file watcher detects the database file was deleted or
moved.

```typescript
{
  type: 'database-unavailable',
  payload: {
    reason: 'deleted' | 'moved' | 'locked',
    message: string,
  }
}
```

### `database-changed`

Sent when the file watcher detects the database file was modified
externally. The webview should offer to reload.

```typescript
{
  type: 'database-changed',
  payload: {}
}
```

## Webview → Extension Messages

### `request-data`

Request a page of data for a table.

```typescript
{
  type: 'request-data',
  requestId: string,         // UUID for response correlation
  payload: {
    tableName: string,
    page: number,            // 0-indexed
    sortColumn: string | null,
    sortDirection: 'asc' | 'desc' | null,
  }
}
```

### `reload-database`

Request the extension to re-read and re-parse the database file
(e.g., after a `database-changed` notification).

```typescript
{
  type: 'reload-database',
  payload: {}
}
```

### `show-error`

Request the extension host to show a VS Code error notification
(webview cannot call `vscode.window.showErrorMessage` directly).

```typescript
{
  type: 'show-error',
  payload: {
    message: string,
  }
}
```

## Message Flow Diagrams

### File Open (US1)

```
User clicks .db file
  → VS Code invokes CustomReadonlyEditorProvider.openCustomDocument()
  → Extension reads file with sql.js, extracts schema
  → Extension sends 'schema-loaded' to webview
  → Webview renders schema tree
```

### ER Diagram (US2)

```
User clicks "Show ER Diagram" in webview
  → Webview computes ELK layout from already-loaded schema data
  → Webview renders ReactFlow diagram (no extension roundtrip needed)
```

### Data Preview (US3)

```
User right-clicks table → "Preview Data"
  → Webview sends 'request-data' { tableName, page: 0 }
  → Extension queries SQLite with LIMIT/OFFSET
  → Extension sends 'data-page' response
  → Webview renders data grid
```

### Sort / Paginate

```
User clicks column header or pagination control
  → Webview sends 'request-data' { tableName, page, sortColumn, sortDirection }
  → Extension re-queries SQLite
  → Extension sends 'data-page' response
  → Webview updates grid
```
