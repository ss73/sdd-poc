# Tasks: Inline Data Editing

**Input**: Design documents from `/specs/003-inline-data-editing/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/messages.md, quickstart.md

**Tests**: Not requested — no test tasks included.

**Organization**: Tasks are grouped into two implementation phases (Phase A: migration checkpoint, Phase B: editing by user story) per plan.md.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Swap SQLite library dependency and update build config

- [X] T001 Replace sql.js with node-sqlite3-wasm in package.json and remove sql-wasm.wasm copy step from esbuild.mjs (see research.md R1, R7 for API differences and esbuild.mjs for current wasm copy logic)

---

## Phase 2: Foundational — Migrate to node-sqlite3-wasm (Read-Only Checkpoint)

**Purpose**: Migrate all existing read-only logic from sql.js to node-sqlite3-wasm. **All existing features must work identically before proceeding.**

**CRITICAL**: No editing work (Phase 3+) can begin until this checkpoint passes.

- [X] T002 Migrate src/sqliteService.ts from sql.js to node-sqlite3-wasm: change openDatabase(buffer: Uint8Array) to openDatabase(filePath: string) using `new Database(filePath, { fileMustExist: true })`, adapt all query methods from `db.exec(sql)[0]` to `db.all(sql)` return format, and ensure `db.close()` is called on dispose (see research.md R7 for full migration mapping)
- [X] T003 Update src/schemaProvider.ts to pass uri.fsPath to sqliteService.openDatabase() instead of reading the file into a buffer with vscode.workspace.fs.readFile() (see research.md R7)
- [X] T004 Build with `npm run build` and manually smoke test all existing read-only features: schema tree loads with tables/columns/indexes, search/filter works, data preview with pagination and sorting works, ER diagram renders, file watcher detects external changes, error handling for invalid files works (see plan.md Phase A checklist)

**Checkpoint**: All existing features work identically with node-sqlite3-wasm. Migration verified.

---

## Phase 3: User Story 1 — Edit a Single Cell Value (Priority: P1) MVP

**Goal**: User can double-click a cell, edit its value, and persist the change to the database file immediately.

**Independent Test**: Open a database, double-click a cell, change its value, press Enter, reload the database, verify the new value persists.

### Implementation for User Story 1

- [X] T005 [P] [US1] Add UpdateCellMessage and UpdateResultMessage types to src/types.ts, extend DataPage with primaryKeyColumns, rowIdentifiers, readOnly, and editableColumns fields per contracts/messages.md, and add both new message types to the ExtensionToWebviewMessage and WebviewToExtensionMessage union types
- [X] T006 [P] [US1] Add updateCell(tableName, columnName, newValue, rowIdentifier) method to src/sqliteService.ts using parameterized `db.run("UPDATE ... SET ... = ? WHERE ... = ?", params)` with double-quote identifier escaping for table/column names, and add getRowIdentifiers(tableName) to detect PK columns via `PRAGMA table_info()` with rowid fallback for tables without explicit PK (see research.md R3, R4)
- [X] T007 [US1] Change src/schemaProvider.ts from CustomReadonlyEditorProvider to CustomEditorProvider with minimal saveCustomDocument/revertCustomDocument stubs, and extend the data-page response handler to include primaryKeyColumns, rowIdentifiers, readOnly (check file access), and editableColumns (exclude PK and BLOB columns) using the new sqliteService methods (see research.md R2, contracts/messages.md)
- [X] T008 [US1] Add update-cell message handler to src/schemaProvider.ts: call sqliteService.updateCell(), set isWritingBack flag before write to suppress file watcher false alarm, re-fetch current page after success, and send update-result response with refreshed DataPage or error (see research.md R5, R6, contracts/messages.md message flow)
- [X] T009 [US1] Add CellEdit state (per data-model.md), double-click handler on editable td cells, inline text input pre-filled with current value (empty for NULL), visual edit mode indicator (highlighted border/background using VS Code theme variables), and prevent edit on non-editable columns, when readOnly is true, or when databaseChanged is true (pending reload) — accept databaseChanged as a prop from App.tsx in src/webview/DataPreview.tsx (FR-001, FR-002, FR-008, FR-009, FR-011)
- [X] T010 [US1] Wire Enter (commit), Escape (cancel), and blur (commit) handlers in src/webview/DataPreview.tsx: send update-cell message with rowIdentifier on commit, listen for update-result response, update data state on success, restore original value on cancel (FR-003, FR-004, FR-010, acceptance scenarios 1–5)

**Checkpoint**: User can edit any non-PK, non-BLOB cell and see the persisted result. Basic save/cancel works end-to-end.

---

## Phase 4: User Story 2 — Edit Feedback and Error Handling (Priority: P2)

**Goal**: Constraint violation errors (NOT NULL, UNIQUE, FK, referential integrity, SQLITE_BUSY) are displayed inline with actionable messages. Cell stays in edit mode after failure.

**Independent Test**: Try setting a NOT NULL column to empty, entering a duplicate UNIQUE value, or an invalid FK reference — verify an inline error appears and the cell remains editable.

### Implementation for User Story 2

- [X] T011 [US2] Parse SQLite constraint error messages into human-readable descriptions in the update-cell handler in src/schemaProvider.ts: map SQLITE_CONSTRAINT_NOTNULL to "This column cannot be empty", SQLITE_CONSTRAINT_UNIQUE to "This value already exists", SQLITE_CONSTRAINT_FOREIGNKEY to "No matching record in referenced table" / "Other records depend on this value", and SQLITE_BUSY to "Database is locked by another process" (FR-005, acceptance scenarios 1–4)
- [X] T012 [US2] Display inline error message below the edited cell in src/webview/DataPreview.tsx, keep cell in edit mode with error visible after failed save (FR-006), and dismiss error when user begins typing a new value (acceptance scenario 6)

**Checkpoint**: All constraint violations produce clear, actionable inline error messages. Cell stays editable after failure.

---

## Phase 5: User Story 3 — Set a Cell to NULL (Priority: P3)

**Goal**: Users can explicitly set a nullable column's value to database NULL, distinct from an empty string.

**Independent Test**: Edit a nullable cell, use the Set NULL action, save, verify the cell displays the NULL indicator (not empty string).

### Implementation for User Story 3

- [X] T013 [US3] Add a "Set NULL" button/action to the edit controls in src/webview/DataPreview.tsx that sends null as newValue in the update-cell message, hide the action for NOT NULL columns (using column metadata from DataPage), and display the existing NULL indicator styling after save (FR-007, acceptance scenarios 1–2)

**Checkpoint**: NULL and empty string are clearly distinguishable. Set NULL action respects NOT NULL constraints.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases and final validation

- [X] T014 Handle remaining edge cases in src/webview/DataPreview.tsx and src/schemaProvider.ts: BLOB cells display a non-editable indicator, long text values use a scrollable input without layout breakage, and WITHOUT ROWID tables without PK disable editing with a clear message (spec edge cases)
- [X] T015 Final build with `npm run build` and end-to-end manual validation per quickstart.md test flow steps 1–9

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all editing work
- **US1 (Phase 3)**: Depends on Phase 2 checkpoint passing
- **US2 (Phase 4)**: Depends on US1 (needs the edit flow to exist before adding error handling)
- **US3 (Phase 5)**: Depends on US1 (needs the edit flow to exist before adding Set NULL)
- **Polish (Phase 6)**: Depends on US1, US2, US3

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 2 checkpoint only — no dependencies on other stories
- **US2 (P2)**: Depends on US1 (error handling extends the existing edit flow)
- **US3 (P3)**: Depends on US1 (Set NULL extends the existing edit controls). Can run in parallel with US2.

### Within Each Phase

- Phase 2: T002 → T003 → T004 (sequential — each depends on previous)
- Phase 3: T005 ∥ T006 (parallel, different files) → T007 → T008 → T009 → T010
- Phase 4: T011 → T012 (schema provider first, then webview)
- Phase 5: T013 (single task)
- Phase 6: T014 → T015 (edge cases then final validation)

### Parallel Opportunities

```
Phase 3 (US1):
  T005 (src/types.ts) ∥ T006 (src/sqliteService.ts)  — different files, no dependencies

Phase 4+5 (US2 ∥ US3):
  US2 and US3 can run in parallel after US1 is complete
  T011 (src/schemaProvider.ts) ∥ T013 (src/webview/DataPreview.tsx) — different files
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Migration checkpoint (T002–T004)
3. **STOP and VALIDATE**: All existing features work with node-sqlite3-wasm
4. Complete Phase 3: User Story 1 (T005–T010)
5. **STOP and VALIDATE**: Basic cell editing works end-to-end

### Incremental Delivery

1. Setup + Migration → Read-only checkpoint verified
2. Add US1 → Cell editing MVP → Validate
3. Add US2 → Constraint error messages → Validate
4. Add US3 → Set NULL mechanism → Validate
5. Polish → Edge cases + final validation

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Phase 2 is a hard gate — do not proceed until smoke test passes
- US2 and US3 can run in parallel after US1 is complete
- Commit after each task or logical group
- Stop at any checkpoint to validate independently
