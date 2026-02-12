# Tasks: Row Insert and Delete

**Input**: Design documents from `/specs/004-row-insert-delete/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/messages.md

**Tests**: Not requested — no test tasks generated.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: No new dependencies or files are needed. This feature modifies 4 existing files only.

- [x] T001 Verify clean build baseline by running `npm run build` and `npx tsc --noEmit`

---

## Phase 2: Foundational (Shared Types)

**Purpose**: Add all new message types and extend existing unions in types.ts — needed by both US1 and US2.

- [x] T002 Add DeleteRowMessage, InsertRowMessage, DeleteResultMessage, and InsertResultMessage interfaces to `src/types.ts`. Add `'delete-row'` and `'insert-row'` to the WebviewMessage union type. Add `'delete-result'` and `'insert-result'` to the ExtensionMessage union type. Include the DataPage type in result payloads. Contracts defined in `specs/004-row-insert-delete/contracts/messages.md`.

**Checkpoint**: Types compile — `npx tsc --noEmit` passes

---

## Phase 3: User Story 1 — Delete a Row (Priority: P1) MVP

**Goal**: Users can select a row, trigger delete with inline confirmation, and have the row removed from the database.

**Independent Test**: Open test.db, click a row to select it, click Delete, confirm, verify row is gone after reload.

### Implementation for User Story 1

- [x] T003 [P] [US1] Add `deleteRow(tableName: string, rowIdentifier: Record<string, unknown>): void` method to `src/sqliteService.ts`. Build a parameterized `DELETE FROM "table" WHERE pk = ?` query using `escapeId()` and the rowIdentifier entries (same pattern as `updateCell()`).

- [x] T004 [P] [US1] Add row selection state and UI to `src/webview/DataPreview.tsx`: (a) Add `RowSelection` state (`{ rowIndex: number; rowIdentifier: Record<string, unknown> } | null`). (b) Add click handler on data rows that sets selection (highlight with CSS background). (c) Clear selection on page change, sort change, or when clicking the already-selected row again. (d) Add a "Delete" toolbar button that is disabled when no row is selected, `readOnly` is true, or `databaseChanged` is true.

- [x] T005 [US1] Add inline delete confirmation UI to `src/webview/DataPreview.tsx`: (a) Add `DeleteConfirmation` state (`{ rowIndex: number; rowIdentifier: Record<string, unknown>; isDeleting: boolean; error: string | null } | null`). (b) When Delete button is clicked, show an inline confirmation bar above the grid with "Delete this row?" text and Confirm/Cancel buttons. (c) Cancel clears the confirmation state. (d) Confirm sends a `delete-row` message with `requestId` and the selected row's identifier. (e) While waiting for response, show a loading/disabled state on Confirm button.

- [x] T006 [US1] Add `delete-row` message handler to `src/schemaProvider.ts`: (a) Handle incoming `delete-row` message from webview. (b) Set `isWritingBack = true`, call `sqliteService.deleteRow()`, then re-fetch the current page using existing `getRows()`. (c) Set `isWritingBack = false` after the file watcher would have fired (same setTimeout pattern as `update-cell`). (d) Send `delete-result` message back with `{ success: true, updatedData }` or `{ success: false, error }`. (e) Track current page/sort state needed for re-fetch (reuse existing page state tracking from update-cell handler).

- [x] T007 [US1] Add `delete-result` message listener to `src/webview/DataPreview.tsx`: (a) On success: update displayed data from `updatedData`, clear `deleteConfirmation` state, clear `selectedRow` state. (b) On error: update `deleteConfirmation.error` with the error message, keep confirmation bar visible. (c) Handle last-row-on-page edge case: if `updatedData` returns an empty rows array and current page > 0, request the previous page.

**Checkpoint**: Row select + delete flow works end-to-end. Build passes.

---

## Phase 4: User Story 2 — Insert a New Row (Priority: P2)

**Goal**: Users can add a transient row to the grid, fill in values using inline inputs, and commit the new row to the database.

**Independent Test**: Open test.db, click "Add Row", fill in column values, click Save, verify the row persists after reload.

### Implementation for User Story 2

- [x] T008 [P] [US2] Add `insertRow(tableName: string, columnValues: Record<string, unknown>): void` method to `src/sqliteService.ts`. Build a parameterized `INSERT INTO "table" ("col1", "col2") VALUES (?, ?)` query using only the columns present in `columnValues` (omitted columns get database defaults). Use `escapeId()` for table and column names.

- [x] T009 [US2] Add NewRow composition state and UI to `src/webview/DataPreview.tsx`: (a) Add `NewRow` state (`{ values: Record<string, string>; errors: Record<string, string>; isSaving: boolean; globalError: string | null } | null`). (b) Add "Add Row" toolbar button, disabled when `readOnly`, `databaseChanged`, or when a NewRow is already active. Also disable when table has no editable columns. (c) When clicked, set `newRow` to initial state with empty values. (d) Render a transient row at the bottom of the data grid with inline `<input>` elements for each editable column. (e) Auto-increment PK columns show "(auto)" placeholder text and are not editable. (f) BLOB columns show "(blob)" placeholder and are not editable. (g) Add Save and Cancel buttons in the new row or in the confirmation bar area.

- [x] T010 [US2] Add commit and cancel logic for NewRow in `src/webview/DataPreview.tsx`: (a) Save: collect all non-empty values from `newRow.values`, send `insert-row` message with `requestId`, `tableName`, and `columnValues`. Set `isSaving = true`. (b) Cancel: if all values are empty, clear `newRow` immediately. If any values are entered, show a brief confirmation ("Discard changes?") before clearing. (c) Escape key triggers cancel. (d) Disable the Delete button and row selection while NewRow is active.

- [x] T011 [US2] Add `insert-row` message handler to `src/schemaProvider.ts`: (a) Handle incoming `insert-row` message from webview. (b) Set `isWritingBack = true`, call `sqliteService.insertRow()`, then re-fetch the current page. (c) Set `isWritingBack = false` after file watcher delay. (d) Send `insert-result` message back with `{ success: true, updatedData }` or `{ success: false, error }`. (e) Reuse `parseConstraintError()` for human-readable error messages on failure.

- [x] T012 [US2] Add `insert-result` message listener to `src/webview/DataPreview.tsx`: (a) On success: update displayed data from `updatedData`, clear `newRow` state. (b) On error: set `newRow.globalError` with the error message, set `isSaving = false`, keep the transient row visible and editable so the user can fix values.

**Checkpoint**: Insert flow works end-to-end. Both delete and insert work together. Build passes.

---

## Phase 5: User Story 3 — Delete Error Handling (Priority: P3)

**Goal**: When delete fails due to FK violations or database locks, the user sees a clear, actionable error message.

**Independent Test**: Attempt to delete a row referenced by a FK in another table; verify a clear error message appears and the row remains.

### Implementation for User Story 3

- [x] T013 [US3] Enhance delete error handling in `src/schemaProvider.ts`: (a) Ensure `parseConstraintError()` covers delete-specific constraint messages (FK violation on DELETE, SQLITE_BUSY/locked). (b) If needed, add delete-specific error message formatting (e.g., "Cannot delete: this row is referenced by rows in another table"). (c) Verify the error message is passed back in the `delete-result` message payload.

- [x] T014 [US3] Display delete errors in the inline confirmation bar in `src/webview/DataPreview.tsx`: (a) When `deleteConfirmation.error` is set, show the error text in the confirmation bar with appropriate styling (red/warning). (b) Keep Confirm and Cancel buttons visible so the user can retry or cancel. (c) Clear the error when the user cancels or tries again.

**Checkpoint**: Delete error messages display correctly. Row remains after failed delete. Build passes.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all user stories.

- [x] T015 Run `npm run build` and `npx tsc --noEmit` to verify clean build with all changes
- [x] T016 Run through quickstart.md test flows (sections 1-9) to validate all scenarios

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — verify baseline
- **Foundational (Phase 2)**: Depends on Phase 1 — adds shared types
- **US1 Delete (Phase 3)**: Depends on Phase 2 — T003 and T004 can run in parallel
- **US2 Insert (Phase 4)**: Depends on Phase 2 — T008 can run in parallel with US1 tasks
- **US3 Error Handling (Phase 5)**: Depends on Phase 3 (delete must work before error handling)
- **Polish (Phase 6)**: Depends on all previous phases

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — no dependencies on other stories
- **US2 (P2)**: Can start after Phase 2 — independent of US1 (but sequentially recommended since both modify DataPreview.tsx)
- **US3 (P3)**: Depends on US1 completion (enhances delete error path)

### Within Each User Story

- Service methods before message handlers (sqliteService before schemaProvider)
- Message handlers before UI listeners (schemaProvider before DataPreview result handling)
- UI state before UI interactions (selection state before delete confirmation)

### Parallel Opportunities

**Phase 3 (US1)**:
```
# T003 and T004 can run in parallel (different files):
T003: sqliteService.ts — deleteRow() method
T004: DataPreview.tsx — row selection state + UI
```

**Phase 4 (US2)**:
```
# T008 can run in parallel with T009 (different files):
T008: sqliteService.ts — insertRow() method
T009: DataPreview.tsx — NewRow state + UI
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup verification
2. Complete Phase 2: Add shared types to types.ts
3. Complete Phase 3: US1 — Delete Row (T003-T007)
4. **STOP and VALIDATE**: Test delete flow independently
5. Build and demo if ready

### Incremental Delivery

1. Phase 1 + Phase 2 → Types ready
2. Add US1 (Delete) → Test independently → Working delete
3. Add US2 (Insert) → Test independently → Working insert
4. Add US3 (Error Handling) → Test delete errors → Robust experience
5. Polish → Final build verification

---

## Notes

- 4 files modified, 0 new files — all changes to existing src/ files
- No new dependencies required
- [P] tasks target different files with no dependencies
- US1 and US2 both modify DataPreview.tsx — sequential execution recommended to avoid merge conflicts
- All SQL operations use parameterized queries (constitution principle III)
- All write operations use the isWritingBack file watcher pattern from feature 003
