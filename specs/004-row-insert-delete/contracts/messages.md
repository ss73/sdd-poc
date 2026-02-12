# Message Contracts: Row Insert and Delete

**Feature**: 004-row-insert-delete
**Date**: 2026-02-12

## New Messages

### Webview → Extension

#### `delete-row`

Sent when the user confirms row deletion.

```typescript
interface DeleteRowMessage {
  type: 'delete-row';
  requestId: string;
  payload: {
    tableName: string;
    rowIdentifier: Record<string, unknown>;  // PK or rowid key-value pairs
  };
}
```

#### `insert-row`

Sent when the user commits a new row.

```typescript
interface InsertRowMessage {
  type: 'insert-row';
  requestId: string;
  payload: {
    tableName: string;
    columnValues: Record<string, unknown>;  // column name → value (only user-provided columns)
  };
}
```

### Extension → Webview

#### `delete-result`

Sent in response to `delete-row`.

```typescript
interface DeleteResultMessage {
  type: 'delete-result';
  requestId: string;
  payload: {
    success: boolean;
    error: string | null;        // Human-readable constraint error
    updatedData: DataPage | null; // Refreshed current page if success
  };
}
```

#### `insert-result`

Sent in response to `insert-row`.

```typescript
interface InsertResultMessage {
  type: 'insert-result';
  requestId: string;
  payload: {
    success: boolean;
    error: string | null;        // Human-readable constraint error
    updatedData: DataPage | null; // Refreshed current page if success
  };
}
```

## Message Flow

### Delete Flow
```
1. User clicks row to select it → RowSelection state updated (local only)
2. User triggers delete → DeleteConfirmation state shown (local only)
3. User confirms → DataPreview sends 'delete-row' with rowIdentifier
4. Extension executes DELETE, sets isWritingBack, re-fetches page
5. Extension returns 'delete-result' with success + refreshed data
   OR 'delete-result' with error message
6. DataPreview updates UI accordingly
```

### Insert Flow
```
1. User clicks "Add Row" → NewRow state created (local only)
2. User fills in cell values using inline inputs (local only)
3. User clicks "Save" or presses Enter → DataPreview sends 'insert-row' with columnValues
4. Extension executes INSERT, sets isWritingBack, re-fetches page
5. Extension returns 'insert-result' with success + refreshed data
   OR 'insert-result' with error message
6. DataPreview updates UI accordingly
```
