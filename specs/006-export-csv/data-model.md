# Data Model: Export to CSV for Result Sets

This feature introduces no persistent data entities. All data flows are transient (in-memory or written to a user-chosen file). The following describes the logical structures involved.

---

## Entities

### ExportRequest (in-memory, webview → extension)

The payload sent from the webview to the extension host when the user clicks "Export to CSV".

**Variant A — Query Tab**

| Field | Type | Description |
|-------|------|-------------|
| `source` | `'query-tab'` | Discriminant |
| `columns` | `string[]` | Column headers from the query result |
| `rows` | `unknown[][]` | All rows from the query result (already fully loaded in webview) |
| `suggestedFilename` | `string` | e.g., `"Query 1.csv"` derived from tab label |

**Variant B — Table Preview**

| Field | Type | Description |
|-------|------|-------------|
| `source` | `'table-preview'` | Discriminant |
| `tableName` | `string` | The table to export (extension fetches all rows) |
| `suggestedFilename` | `string` | e.g., `"users.csv"` derived from table name |

---

### ExportResult (in-memory, extension → webview)

The response sent back to the webview after the export completes, fails, or is cancelled.

| Field | Type | Description |
|-------|------|-------------|
| `status` | `'success' \| 'error' \| 'cancelled'` | Outcome of the export attempt |
| `rowCount` | `number \| undefined` | Number of rows written (present on success) |
| `filePath` | `string \| undefined` | Absolute path of the written file (present on success) |
| `error` | `string \| undefined` | Human-readable error description (present on error) |

---

### CsvFile (on-disk artifact)

The file written by the extension host.

| Attribute | Value |
|-----------|-------|
| Encoding | UTF-8 (no BOM) |
| Line endings | CRLF (`\r\n`) |
| Delimiter | Comma (`,`) |
| Quoting | RFC 4180: fields containing `,`, `"`, or `\n`/`\r` are enclosed in `"..."` |
| Escape rule | `"` inside a quoted field → `""` |
| NULL representation | Empty field |
| BLOB representation | Literal text `(BLOB)` |
| First row | Column headers |
| Subsequent rows | One row per result set row |

---

## State Transitions

### Export Button State (per panel)

```
[disabled]  ─── result set becomes available ──→  [enabled]
[enabled]   ─── user clicks Export ────────────→  [exporting] (button disabled)
[exporting] ─── export-csv-result received ────→  [enabled]  (success / error / cancelled)
```

No persistent state. Button state is derived from React component state in each panel.

---

## Data Flow

```
User clicks "Export to CSV"
        │
        ▼
Webview sets button → disabled
Webview sends export-csv message
        │
        ▼
Extension: showSaveDialog()
        │ cancelled? → send export-csv-result {status:'cancelled'} → done
        │ uri chosen
        ▼
Extension: withProgress (cancellable notification)
        │
        ├─ [query-tab]  use columns+rows from message payload
        │
        └─ [table-preview]  sqliteService.getAllTableRows(tableName)
                │ token.isCancellationRequested? → delete partial file → send 'cancelled'
                ▼
        csvFormatter.formatCsv(columns, rows)
                │ token.isCancellationRequested? → send 'cancelled'
                ▼
        vscode.workspace.fs.writeFile(uri, buffer)
                │ error? → delete partial file → send export-csv-result {status:'error'}
                ▼
        send export-csv-result {status:'success', rowCount, filePath}
        vscode.window.showInformationMessage(...)
        │
        ▼
Webview receives export-csv-result → button re-enabled
```
