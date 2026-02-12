# Message Contracts: Inline Data Editing

**Feature**: 003-inline-data-editing
**Date**: 2026-02-12

## New Messages

### Webview → Extension

#### `update-cell`

Sent when the user confirms an edit (Enter or blur).

```typescript
interface UpdateCellMessage {
  type: 'update-cell';
  requestId: string;
  payload: {
    tableName: string;
    columnName: string;
    newValue: unknown;       // string, number, null
    rowIdentifier: Record<string, unknown>;  // PK or rowid key-value pairs
  };
}
```

### Extension → Webview

#### `update-result`

Sent in response to `update-cell`. Contains success/failure and refreshed data on success.

```typescript
interface UpdateResultMessage {
  type: 'update-result';
  requestId: string;
  payload: {
    success: boolean;
    error: string | null;        // Human-readable constraint error
    updatedData: DataPage | null; // Refreshed current page if success
  };
}
```

## Modified Messages

### `request-data` (existing, modified payload)

Add `includeRowIds` flag to request rowid alongside row data when the table has no explicit primary key.

```typescript
interface RequestDataMessage {
  type: 'request-data';
  requestId: string;
  payload: {
    tableName: string;
    page: number;
    sortColumn: string | null;
    sortDirection: 'asc' | 'desc' | null;
    includeRowIds?: boolean;  // NEW: request rowid for editing
  };
}
```

### `data-page` (existing, modified payload)

Add primary key metadata and per-row identifiers to enable building WHERE clauses in the webview.

```typescript
interface DataPage {
  tableName: string;
  columns: string[];
  rows: unknown[][];
  page: number;
  totalRows: number;
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc' | null;
  // NEW fields:
  primaryKeyColumns: string[];              // PK column names (or ['rowid'] for implicit)
  rowIdentifiers: Record<string, unknown>[]; // One per row, PK values for WHERE clause
  readOnly: boolean;                         // True if file is read-only/locked
  editableColumns: string[];                 // Column names that can be edited (excludes PKs, BLOBs)
}
```

## Message Flow

```
1. User opens table → DataPreview sends 'request-data'
2. Extension returns 'data-page' with PK info, editableColumns, readOnly flag
3. User double-clicks editable cell → enters edit mode (local state only)
4. User confirms edit → DataPreview sends 'update-cell' with rowIdentifier
5. Extension executes UPDATE, writes to disk, re-fetches page
6. Extension returns 'update-result' with success + refreshed data
   OR 'update-result' with error message
7. DataPreview updates UI accordingly
```
