# Message Contracts: Custom Query Tabs

**Feature**: 005-custom-query-tabs
**Date**: 2026-02-12

## New Messages

### Webview → Extension

#### `execute-query`

Sent when the user triggers query execution.

```typescript
interface ExecuteQueryMessage {
  type: 'execute-query';
  requestId: string;
  payload: {
    sql: string;
  };
}
```

### Extension → Webview

#### `query-result`

Sent in response to `execute-query`.

```typescript
interface QueryResultMessage {
  type: 'query-result';
  requestId: string;
  payload: {
    type: 'rows' | 'affected' | 'error';
    columns: string[];        // Column names (empty if not a SELECT)
    rows: unknown[][];         // Row data (empty if not a SELECT)
    affectedRows: number;      // Rows affected (0 if SELECT or error)
    error: string | null;      // Error message (null if success)
  };
}
```

## Message Flow

### Query Execution Flow
```
1. User types SQL in textarea (local state only)
2. User triggers execute (button or Ctrl+Enter) → webview sends 'execute-query'
3. Extension detects query type:
   a. SELECT → db.all() → returns columns + rows
   b. INSERT/UPDATE/DELETE → sets isWritingBack, db.run() → returns affectedRows
   c. DDL (CREATE/DROP/ALTER) → sets isWritingBack, db.run() → returns affectedRows=0
   d. Error → returns error message
4. Extension sends 'query-result' back to webview
5. Webview updates the active QueryTab's result state
```
