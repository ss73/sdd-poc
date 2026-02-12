# Quickstart: Row Insert and Delete

**Feature**: 004-row-insert-delete
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

### 1. Row Selection

1. Click "Preview Data" on any table in the schema tree
2. Click on a row in the data grid — verify it highlights
3. Click a different row — verify the first row unhighlights and the new row highlights
4. Change page or sort — verify selection clears

### 2. Delete a Row (US1)

1. Select a row by clicking on it
2. Click the "Delete" button — verify a confirmation prompt appears
3. Click "Cancel" — verify the row is unchanged and still selected
4. Click "Delete" again, then "Confirm" — verify the row is removed and the grid refreshes
5. Reload the database — verify the deleted row is still gone

### 3. Delete Edge Cases

1. Navigate to the last page of a multi-page table
2. Delete the last remaining row on that page — verify the grid navigates to the previous page
3. Delete all rows in a single-row table — verify the empty table state is shown

### 4. Insert a New Row (US2)

1. Click the "Add Row" button — verify an empty row appears at the bottom of the grid
2. Click into a cell on the new row and type a value — verify the inline input works
3. Fill in required columns and click "Save" — verify the row is persisted and the grid refreshes
4. Reload the database — verify the inserted row is still there

### 5. Insert with Defaults and Auto-Increment

1. Insert a row into a table with an auto-increment PK — verify the PK column shows "(auto)" and is not editable
2. Leave a column with a default value empty — verify the database default is applied after save
3. Leave a NOT NULL column empty and try to save — verify an inline error appears

### 6. Insert Cancellation

1. Click "Add Row" — the empty row appears
2. Press Escape or click "Cancel" without entering values — verify the row disappears
3. Click "Add Row" again, enter some values, then cancel — verify a confirmation is shown before discarding

### 7. Delete Error Handling (US3)

1. Attempt to delete a row that is referenced by a foreign key in another table — verify a clear error message appears
2. Verify the row remains in the grid after the error

### 8. Read-Only and External Change Guards

1. Open a read-only database file — verify the "Add Row" and "Delete" buttons are disabled
2. Modify the database externally while viewing it — verify the buttons become disabled until reload

### 9. Final Validation

1. Build: `npm run build` — verify no errors
2. Type-check: `npx tsc --noEmit` — verify no errors
