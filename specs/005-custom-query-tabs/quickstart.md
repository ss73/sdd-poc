# Quickstart: Custom Query Tabs

**Feature**: 005-custom-query-tabs
**Date**: 2026-02-12

## Prerequisites

- Node.js 18+
- VS Code 1.85+
- Test database: `test-workspace/test.db`

## Setup

```sh
npm install
npm run build
```

Launch VS Code with extension loaded:

```sh
code --extensionDevelopmentPath="$PWD" test-workspace
```

Open `test.db` from the file explorer.

## Test Flow

### 1. Open a Query Tab

1. Verify a "Query" button appears in the header actions bar
2. Click "Query" — verify a query view opens with an empty textarea and an empty results area
3. Verify the results area shows a hint message (e.g., "Run a query to see results")
4. Verify there is an "Execute" button and a tab bar showing "Query 1"

### 2. Execute a SELECT Query (US1)

1. Type `SELECT * FROM albums` in the textarea
2. Click "Execute" or press Ctrl+Enter (Cmd+Enter on Mac)
3. Verify results appear in a table below the editor with column headers and data rows
4. Verify the table looks consistent with the data preview (same styling, NULL/BLOB indicators)

### 3. Execute a Write Query (US1)

1. Type `INSERT INTO albums (Title, ArtistId) VALUES ('Test Album', 1)`
2. Execute — verify a message shows "1 row affected" instead of a result table
3. Verify no "database changed" banner appears (isWritingBack flag working)

### 4. Execute an Invalid Query (US1)

1. Type `SELECT * FROM nonexistent_table`
2. Execute — verify a clear error message appears
3. Type `SELEC * FRO albums` (syntax error)
4. Execute — verify a clear error message appears

### 5. Multiple Query Tabs (US2)

1. Click "New Query" (or +) button — verify a second tab "Query 2" appears
2. Type a different query in the second tab
3. Switch back to "Query 1" — verify it still has its query text and results
4. Switch to "Query 2" — verify it has its own query text
5. Close "Query 1" — verify it's removed and "Query 2" remains

### 6. Many Tabs (US2)

1. Open 5+ query tabs — verify each has a unique label
2. Switch between them rapidly — verify no performance issues
3. Close tabs in random order — verify remaining tabs are unaffected

### 7. Query Results Pagination (US3)

1. Run `SELECT * FROM tracks` (or any table with many rows)
2. Verify pagination controls appear if there are more than 50 rows
3. Navigate pages — verify data changes per page
4. Verify page info shows correct totals

### 8. Query Results Sorting (US3)

1. Run a SELECT query that returns multiple rows
2. Click a column header — verify results sort by that column
3. Click again — verify sort direction toggles
4. Verify sorting is client-side (no query re-execution, no loading spinner)

### 9. Zero Rows and Edge Cases

1. Run `SELECT * FROM albums WHERE 1=0` — verify headers show but table says "No results"
2. Run a DDL statement like `CREATE TABLE test_temp (id INTEGER)` — verify success message
3. Clean up: `DROP TABLE test_temp` — verify success
4. Verify the query tab does not allow execution while a query is already running (button disabled)

### 10. View Switching

1. From the query view, click "Schema Tree" — verify schema view appears
2. Click "Query" again — verify query tabs are still there with their state
3. Click "ER Diagram" — verify ER diagram appears
4. Click "Query" again — verify query tabs persist across view switches

### 11. Loading Indicator

1. Run a query — verify a loading indicator appears briefly while executing
2. Verify the Execute button is disabled during execution

### 12. Final Validation

1. Build: `npm run build` — verify no errors
2. Type-check: `npx tsc --noEmit` — verify no errors
