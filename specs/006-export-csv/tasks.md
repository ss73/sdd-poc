# Tasks: Export to CSV for Result Sets

**Input**: Design documents from `/specs/006-export-csv/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: No test framework installed; manual smoke testing via quickstart.md.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add shared types and the pure CSV formatter that all user stories depend on.

- [x] T001 Add ExportCsvMessage and ExportCsvResultMessage types to `src/types.ts` per contracts/csv-export-messages.ts
- [x] T002 [P] Create pure `formatCsv(columns: string[], rows: unknown[][]): string` function in `src/csvFormatter.ts` implementing RFC 4180 (comma delimiter, CRLF line endings, quote escaping, NULL → empty, BLOB → `(BLOB)`)

**Checkpoint**: Shared types and CSV formatter are available for all user stories.

---

## Phase 2: User Story 1 — Export Query Results to CSV (Priority: P1) 🎯 MVP

**Goal**: Users can export query tab results to a CSV file via an "Export to CSV" button, with save dialog, progress/cancellation, and success/error notifications.

**Independent Test**: Open a database, run a SELECT query in a query tab, click "Export to CSV", save, and verify the file has correct headers and rows (quickstart.md scenarios 1, 2, 4, 6, 7).

### Implementation for User Story 1

- [x] T003 [US1] Add "Export to CSV" button to the query tab result toolbar in `src/webview/QueryView.tsx` — button disabled when no result set is available; sends `export-csv` message with source `'query-tab'`, columns, rows, and suggestedFilename derived from tab label
- [x] T004 [US1] Handle `export-csv` message (source: `'query-tab'`) in `src/schemaProvider.ts` — show save dialog (`showSaveDialog` with CSV filter, default filename from message), format CSV via `formatCsv()`, write file via `vscode.workspace.fs.writeFile`, show progress notification with cancel support (`withProgress`), send `export-csv-result` back to webview
- [x] T005 [US1] Handle `export-csv-result` message in `src/webview/QueryView.tsx` — re-enable the export button on success/error/cancelled

**Checkpoint**: Query tab CSV export is fully functional and independently testable (scenarios 1, 2, 4 from quickstart.md).

---

## Phase 3: User Story 2 — Export Table Preview to CSV (Priority: P2)

**Goal**: Users can export the full contents of a table from the data preview panel to CSV without writing a query.

**Independent Test**: Select a table in the schema tree, view data preview, click "Export to CSV", and verify the output contains all rows (not just the current page) with correct headers (quickstart.md scenario 3, 5).

### Implementation for User Story 2

- [x] T006 [US2] Add `getAllTableRows(tableName: string): { columns: string[]; rows: unknown[][] }` method to `src/sqliteService.ts` — executes `SELECT * FROM "<tableName>"` with no LIMIT, detects BLOB columns using existing column-type logic
- [x] T007 [US2] Add "Export to CSV" button to the data preview toolbar in `src/webview/DataPreview.tsx` — button disabled when no table is selected; sends `export-csv` message with source `'table-preview'`, tableName, and suggestedFilename derived from table name
- [x] T008 [US2] Handle `export-csv` message (source: `'table-preview'`) in `src/schemaProvider.ts` — fetch all rows via `getAllTableRows()`, then format/write/notify using the same flow as US1; send `export-csv-result` back to webview
- [x] T009 [US2] Handle `export-csv-result` message in `src/webview/DataPreview.tsx` — re-enable the export button on success/error/cancelled

**Checkpoint**: Table preview CSV export is fully functional and independently testable (scenarios 3, 5 from quickstart.md).

---

## Phase 4: User Story 3 — Correct CSV Formatting (Priority: P3)

**Goal**: Exported CSV files open correctly in spreadsheet applications (Excel, LibreOffice, Numbers) with proper escaping of commas, quotes, newlines, NULLs, and BLOBs.

**Independent Test**: Export a result set with values containing embedded commas, double-quotes, newlines, NULLs, and BLOBs; open in a spreadsheet app and verify data integrity (quickstart.md scenarios 6, 7).

### Implementation for User Story 3

> Note: Core RFC 4180 formatting is already implemented in T002. This phase validates and hardens edge cases.

- [x] T010 [US3] Verify and harden `formatCsv()` in `src/csvFormatter.ts` — ensure column headers are escaped with the same rules as data values (FR-007), NULL → empty field (FR-008), BLOB detection (Uint8Array/ArrayBuffer) → `(BLOB)` (FR-009), CRLF line endings throughout (FR-010)
- [x] T011 [US3] Handle error and cancellation cleanup in `src/schemaProvider.ts` — on write error or cancellation, delete partial file via `vscode.workspace.fs.delete(uri, { useTrash: false })` (FR-012, FR-013), show error notification with reason (FR-013)

**Checkpoint**: All CSV formatting edge cases are handled. Scenarios 6, 7 from quickstart.md pass.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup across all stories.

- [ ] T012 Run full quickstart.md smoke test plan (all 8 scenarios) — requires manual testing in VS Code
- [ ] T013 Verify success notification shows row count and file path (FR-014) across both query tab and table preview exports — requires manual testing

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **US1 (Phase 2)**: Depends on Phase 1 (types + csvFormatter)
- **US2 (Phase 3)**: Depends on Phase 1 (types + csvFormatter); independent of US1 except for shared handler pattern in schemaProvider.ts
- **US3 (Phase 4)**: Depends on Phase 1 (csvFormatter exists); hardens existing implementation
- **Polish (Phase 5)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 1 — no dependency on other stories
- **User Story 2 (P2)**: Can start after Phase 1 — shares message handler pattern with US1 in schemaProvider.ts, so best done sequentially after US1 to avoid merge conflicts
- **User Story 3 (P3)**: Can start after Phase 1 — hardens csvFormatter from T002

### Within Each User Story

- Webview button → extension handler → result handler (sequential within story)
- US2: sqliteService method (T006) can be done in parallel with webview button (T007)

### Parallel Opportunities

- T001 and T002 can run in parallel (different files)
- Within US2: T006 (sqliteService) and T007 (DataPreview.tsx) can run in parallel
- US3 tasks T010 and T011 can run in parallel (different files)

---

## Parallel Example: Phase 1

```bash
# Launch setup tasks together (different files):
Task: "Add export types to src/types.ts"
Task: "Create csvFormatter in src/csvFormatter.ts"
```

## Parallel Example: User Story 2

```bash
# Launch model + UI tasks together (different files):
Task: "Add getAllTableRows to src/sqliteService.ts"
Task: "Add Export button to src/webview/DataPreview.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (types + csvFormatter)
2. Complete Phase 2: User Story 1 (query tab export)
3. **STOP and VALIDATE**: Run quickstart.md scenarios 1, 2, 4
4. Deploy/demo if ready

### Incremental Delivery

1. Phase 1: Setup → shared infrastructure ready
2. Phase 2: US1 → query tab export works → validate scenarios 1, 2, 4 (MVP!)
3. Phase 3: US2 → table preview export works → validate scenarios 3, 5
4. Phase 4: US3 → formatting hardened → validate scenarios 6, 7
5. Phase 5: Polish → full smoke test (all 8 scenarios)
6. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No test framework; validation via quickstart.md manual smoke tests
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
