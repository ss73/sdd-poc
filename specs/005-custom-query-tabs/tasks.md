# Tasks: Custom Query Tabs

**Input**: Design documents from `/specs/005-custom-query-tabs/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/messages.md

**Tests**: Not requested in the feature specification. Manual testing via quickstart.md.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Message types and backend query execution infrastructure that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T001 Add ExecuteQueryMessage and QueryResultMessage interfaces to src/types.ts per contracts/messages.md — ExecuteQueryMessage has type 'execute-query', requestId: string, payload: { sql: string }; QueryResultMessage has type 'query-result', requestId: string, payload: { type: 'rows' | 'affected' | 'error', columns: string[], rows: unknown[][], affectedRows: number, error: string | null }. Add both to the existing WebviewMessage and ExtensionMessage union types respectively.

- [X] T002 Add executeQuery(sql: string) method to src/sqliteService.ts — detect query type by parsing the first keyword of trimmed SQL: SELECT → use db.all() to get columns and rows; INSERT/UPDATE/DELETE/DDL (CREATE, DROP, ALTER) → use db.run() then db.getRowsModified() for affected row count. Return a result object matching the QueryResultMessage payload structure from contracts/messages.md. Handle errors by catching exceptions and returning { type: 'error', error: errorMessage }.

- [X] T003 Add 'execute-query' message handler to src/schemaProvider.ts — receive ExecuteQueryMessage from webview, for non-SELECT queries (INSERT/UPDATE/DELETE/CREATE/DROP/ALTER) set isWritingBack = true before execution (same pattern as features 003-004), call sqliteService.executeQuery(sql), send QueryResultMessage back to webview with matching requestId. Follow existing message handler patterns in the file.

**Checkpoint**: Backend query execution infrastructure ready — webview can now send queries and receive results

---

## Phase 2: User Story 1 — Run a Custom Query (Priority: P1) 🎯 MVP

**Goal**: User can open a query tab, type SQL, execute it, and see results (table for SELECT, affected rows for DML, or error message)

**Independent Test**: Open a database → click "Query" button → type `SELECT * FROM albums` → click Execute or press Ctrl+Enter → verify results table appears with column headers and data rows

### Implementation for User Story 1

- [X] T004 [US1] Create src/webview/QueryView.tsx component scaffold — define local QueryTab interface (id: string, label: string, query: string, result: QueryResult | null, isExecuting: boolean) and QueryResult interface (type: 'rows' | 'affected' | 'error', columns: string[], rows: unknown[][], affectedRows: number, error: string | null). Initialize with single tab state ("Query 1"). Render textarea for SQL input and an "Execute" button. Add Ctrl+Enter (Cmd+Enter on Mac) keyboard shortcut on the textarea to trigger execution.

- [X] T005 [US1] Add query execution message flow to src/webview/QueryView.tsx — on execute: generate a unique requestId, set isExecuting=true on active tab, post 'execute-query' message via vscodeApi with requestId and sql payload. Add window message event listener for 'query-result' messages: match by requestId, update active tab's result with the payload, set isExecuting=false. Show a loading indicator (e.g., "Executing...") while isExecuting is true. Disable the Execute button while isExecuting is true (FR-014).

- [X] T006 [US1] Add results rendering to src/webview/QueryView.tsx — when result is null: show empty state hint "Run a query to see results" (US1 scenario 6). When result.type is 'rows': render a table with column headers and row data (zero rows: show headers + "No results" message per edge case). When result.type is 'affected': show "{n} row(s) affected" message. When result.type is 'error': show error message with distinct styling. Use table styling consistent with DataPreview (same CSS classes or patterns).

- [X] T007 [US1] Modify src/webview/App.tsx to add 'query' view mode — add 'query' to the ViewMode type/state, add a "Query" button to the header actions bar (alongside existing ER Diagram button), conditionally render the QueryView component when view mode is 'query'. Import QueryView from ./QueryView.

**Checkpoint**: User Story 1 is fully functional — users can execute SQL queries and see results. This is the MVP.

---

## Phase 3: User Story 2 — Multiple Query Tabs (Priority: P2)

**Goal**: User can open multiple query tabs, each with independent query text and results, switch between them, and close individual tabs

**Independent Test**: Open 2+ query tabs → write different queries in each → execute them → switch between tabs → verify each retains its own query and results → close one tab → verify others remain

### Implementation for User Story 2

- [X] T008 [US2] Add multi-tab management to src/webview/QueryView.tsx — convert single-tab state to a tabs array with activeTabId tracking and a sequential counter for tab numbering. Render a tab bar above the editor showing each tab's label ("Query 1", "Query 2", ...) with an active tab indicator. Add a "+" button to create a new tab (incrementing the counter). Add a "×" close button on each tab. When switching tabs, preserve each tab's independent query text and result state. When closing a tab, if it was the active tab, switch to the nearest remaining tab. Ensure requestId-based message matching routes results to the correct tab even if the user switches tabs while a query is running.

**Checkpoint**: Users can work with multiple independent query tabs. US1 + US2 fully functional.

---

## Phase 4: User Story 3 — Query Results Interaction (Priority: P3)

**Goal**: Enhanced results display with pagination, sorting, and proper value formatting for large or complex result sets

**Independent Test**: Run `SELECT * FROM tracks` (large table) → verify pagination appears → navigate pages → click column headers to sort → verify NULL values show "NULL" indicator

### Implementation for User Story 3

- [X] T009 [US3] Add client-side pagination to query results in src/webview/QueryView.tsx — page size of 50 rows (consistent with DataPreview). Show pagination controls (Previous/Next buttons) when result row count exceeds page size. Display page info (e.g., "Page 1 of 5 · 234 rows"). Slice the in-memory rows array for current page display. Reset to page 1 when new query results arrive.

- [X] T010 [US3] Add client-side column sorting to query results in src/webview/QueryView.tsx — make column headers clickable, track sort column and direction (ascending/descending) in tab state, sort the in-memory rows array by the selected column (handle string, number, null comparisons), toggle sort direction on repeated clicks, show sort direction indicator on active column header, reset sort state when new query results arrive. Sorting operates on the full result set before pagination.

- [X] T011 [US3] Add NULL and BLOB value indicators to query result cells in src/webview/QueryView.tsx — render null values with a "NULL" indicator and ArrayBuffer/Uint8Array values with a "(BLOB)" indicator, using the same CSS classes and visual treatment as DataPreview for consistency (SC-005).

**Checkpoint**: All three user stories fully functional. Complete query experience.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Cross-view integration and final validation

- [X] T012 Preserve query tab state across view switches in src/webview/App.tsx — ensure that when the user switches from Query view to Schema Tree or ER Diagram and back, all QueryView state (tabs, queries, results) is maintained. Strategy: keep QueryView mounted but hidden (CSS display:none) or lift tab state to App.tsx. Verify with quickstart.md test flow step 10.

- [X] T013 Build validation — run `npm run build` and `npx tsc --noEmit` to verify no compilation or type errors across all modified and new files.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — start immediately. BLOCKS all user stories.
- **User Story 1 (Phase 2)**: Depends on Foundational completion. T004→T005→T006 (same file, sequential), T007 depends on T004+ (needs QueryView component).
- **User Story 2 (Phase 3)**: Depends on US1 completion (extends QueryView from single to multi-tab).
- **User Story 3 (Phase 4)**: Depends on US1 completion (extends QueryView results rendering). Can run in parallel with US2 if coordinated, but recommended after US2 since both modify QueryView.tsx.
- **Polish (Phase 5)**: Depends on all user stories being complete.

### Within Each Phase

```
Phase 1: T001 → T002 → T003 (sequential: types → sqliteService → schemaProvider)
Phase 2: T004 → T005 → T006 → T007 (T004-T006 same file; T007 different file but depends on QueryView)
Phase 3: T008 (single task)
Phase 4: T009 → T010 → T011 (same file, sequential)
Phase 5: T012 → T013 (T013 validates everything)
```

### Parallel Opportunities

Limited parallelism in this feature since most work is concentrated in a single new file (QueryView.tsx). The main parallel opportunity is:

- **US2 and US3** could theoretically proceed in parallel after US1, since US2 adds tab management and US3 adds results enhancements. However, both modify QueryView.tsx, so sequential execution (US2 then US3) is recommended to avoid merge conflicts.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Foundational (T001–T003)
2. Complete Phase 2: User Story 1 (T004–T007)
3. **STOP and VALIDATE**: Test per quickstart.md steps 1–4 and step 9
4. Build check: `npm run build`

### Incremental Delivery

1. Foundational → Backend ready
2. Add User Story 1 → Test independently → **MVP complete** (single query tab works)
3. Add User Story 2 → Test independently → Multiple tabs work
4. Add User Story 3 → Test independently → Full results interaction
5. Polish → View switching, build validation → Feature complete
