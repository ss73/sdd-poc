# Tasks: SQL Database Visualizer

**Input**: Design documents from `/specs/001-sql-db-visualizer/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/messages.md, research.md

**Tests**: Not explicitly requested in the feature specification. Test tasks are omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, dependencies, and build tooling

- [x] T001 Initialize package.json with name, engines, activationEvents, contributes stub, and install dependencies: sql.js, @xyflow/react, elkjs, react, react-dom, plus dev dependencies: typescript, esbuild, @types/vscode, @types/react, @types/react-dom, eslint, vitest
- [x] T002 [P] Create tsconfig.json with strict mode, ES2020 target, and path aliases; create separate tsconfig for webview (JSX support, DOM lib)
- [x] T003 [P] Configure esbuild with two entry points: (1) src/extension.ts → dist/extension.js (CommonJS, Node.js, external: vscode) and (2) src/webview/index.tsx → dist/webview/index.js (ESM, browser); add copy step for sql-wasm.wasm to dist/; add npm scripts: build, watch, dev, lint, package

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core types, services, and scaffolding that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Define all shared TypeScript types in src/types.ts: TableInfo, Column, Index, ForeignKey, DatabaseSchema, DataPage interfaces (per data-model.md), plus all message types for extension-webview communication (schema-loaded, data-page, error, database-unavailable, database-changed, request-data, reload-database, show-error per contracts/messages.md)
- [x] T005 [P] Implement SQLite schema extraction service in src/sqliteService.ts: initialize sql.js Wasm, openDatabase(fileBuffer) method, getSchema() method using sqlite_master + PRAGMA table_info/index_list/index_info/foreign_key_list queries, close() method; return typed TableInfo[] (per data-model.md SQL queries)
- [x] T006 [P] Scaffold webview entry point in src/webview/index.tsx (React 18 createRoot, render App) and typed postMessage wrapper in src/webview/vscodeApi.ts (acquireVsCodeApi singleton, sendMessage/onMessage helpers with message type discrimination)
- [x] T007 Implement SchemaProvider skeleton in src/schemaProvider.ts: class implementing CustomReadonlyEditorProvider, openCustomDocument() stub, resolveCustomEditor() that creates WebviewPanel with nonce-based Content Security Policy, loads dist/webview/index.js bundle, sets retainContextWhenHidden: true
- [x] T008 Implement extension entry point in src/extension.ts: activate() registers SchemaProvider via vscode.window.registerCustomEditorProvider, deactivate() disposes resources

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Open and Browse Database Schema (Priority: P1) MVP

**Goal**: Click a .db/.sqlite/.sqlite3 file in the file explorer to immediately see the database schema as an interactive tree with tables, columns, types, constraints, and indexes

**Independent Test**: Place a SQLite file in the workspace, click it, verify the schema tree renders with correct tables, columns (with types and constraint icons), and indexes. Try an invalid file and verify the error message. Open a second file and verify it replaces the first.

### Implementation for User Story 1

- [x] T009 [US1] Register custom editor contribution in package.json: add contributes.customEditors entry for SchemaProvider with selector for .db, .sqlite, .sqlite3 extensions and priority "default"
- [x] T010 [US1] Complete SchemaProvider database loading in src/schemaProvider.ts: in resolveCustomEditor(), read file via vscode.workspace.fs, pass buffer to SqliteService.openDatabase(), call getSchema(), send schema-loaded message to webview; enforce one-database-at-a-time by disposing previous document (FR-008)
- [x] T011 [US1] Implement App.tsx view router in src/webview/App.tsx: listen for schema-loaded message, store schema in state, render SchemaTree as default view; add view switching state for future ER diagram and data preview views
- [x] T012 [US1] Implement SchemaTree.tsx in src/webview/SchemaTree.tsx: render collapsible tree with table nodes → column children (showing name, type, PK/FK/NOT NULL icons) and indexes node → index children (showing name, uniqueness, indexed columns); use VS Code CSS custom properties for theming
- [x] T013 [US1] Add real-time search/filter to schema tree in src/webview/SchemaTree.tsx: text input above tree that filters tables and columns by name as user types, matching tables show all children, matching columns show parent table (FR-003, SC-003: <200ms for 500 tables)
- [x] T014 [US1] Add error handling for invalid SQLite files in src/schemaProvider.ts: catch sql.js errors on open, send error message to webview with user-actionable text (e.g., "This file is not a valid SQLite database"), handle permission denied and file locked cases (FR-009, SC-007)
- [x] T015 [US1] Add FileSystemWatcher in src/schemaProvider.ts: watch the opened file path for changes (send database-changed message to webview) and deletion (send database-unavailable message); handle reload-database message from webview to re-read and re-parse the file (FR-011)

**Checkpoint**: User Story 1 fully functional - users can click SQLite files and browse schema

---

## Phase 4: User Story 2 - Interactive ER Diagram (Priority: P2)

**Goal**: View an interactive entity-relationship diagram showing tables as boxes with columns and foreign key relationship lines, with pan/zoom/click-to-select and automatic layout

**Independent Test**: Open a SQLite file with 3+ tables that have foreign key relationships, click "Show ER Diagram", verify all tables render as boxes with columns, FK lines connect correct tables, diagram is pannable/zoomable, clicking a table highlights it and shows details

### Implementation for User Story 2

- [x] T016 [P] [US2] Implement TableNode.tsx custom ReactFlow node in src/webview/TableNode.tsx: render table name header, column list with name/type/PK/FK icons, source and target handles on FK columns for edge connections; style with VS Code CSS custom properties
- [x] T017 [US2] Implement ErDiagram.tsx in src/webview/ErDiagram.tsx: convert schema TableInfo[] to ReactFlow nodes (using TableNode) and edges (from ForeignKey data), compute layout via ELK.js (layered/Sugiyama algorithm with orthogonal edge routing), render ReactFlow canvas with pan/zoom controls (SC-002: <3s for 100 tables)
- [x] T018 [US2] Add "Show ER Diagram" button in schema tree header and integrate view switching in src/webview/App.tsx: clicking the button switches the main view from SchemaTree to ErDiagram, passing the loaded schema data (no extension roundtrip per contracts/messages.md ER flow)
- [x] T019 [US2] Add table interaction in src/webview/ErDiagram.tsx: click-to-select with highlight and detail tooltip showing columns/types/constraints; right-click context menu with "Preview Data" (triggers US3 view) and "Copy Table Name"

**Checkpoint**: User Stories 1 AND 2 both work independently

---

## Phase 5: User Story 3 - Table Data Preview (Priority: P3)

**Goal**: Preview table data in a paginated, read-only HTML grid with sortable columns, 50 rows per page, with NULL values visually distinct from empty strings

**Independent Test**: Open a SQLite file, select a table, trigger "Preview Data", verify 50 rows display with correct values, click column headers to sort, use pagination to navigate pages, confirm NULL values look different from empty strings

### Implementation for User Story 3

- [x] T020 [P] [US3] Add data query methods to src/sqliteService.ts: getRows(tableName, page, sortColumn, sortDirection) using SELECT with quoted identifiers, LIMIT 50, OFFSET calculation; getRowCount(tableName) using SELECT COUNT(*); return typed DataPage (per data-model.md)
- [x] T021 [US3] Add request-data message handling in src/schemaProvider.ts: listen for request-data from webview, call SqliteService.getRows() with parameters, send data-page response back to webview with requestId correlation (per contracts/messages.md)
- [x] T022 [US3] Implement DataPreview.tsx in src/webview/DataPreview.tsx: HTML table with column headers from data-page response, render rows with cell values, style NULL values with distinct visual treatment (italic + muted color) to differentiate from empty strings (FR-012)
- [x] T023 [US3] Add pagination controls to src/webview/DataPreview.tsx: previous/next buttons, current page and total pages indicator, send request-data messages on page change with updated page number
- [x] T024 [US3] Add column sorting to src/webview/DataPreview.tsx: clickable column headers that toggle ascending → descending → no sort, send request-data with sortColumn and sortDirection, show sort indicator arrow in active header (FR-007)
- [x] T025 [US3] Add "Preview Data" trigger in src/webview/App.tsx: right-click context menu on table in SchemaTree and table node in ErDiagram switches view to DataPreview for the selected table, sends initial request-data for page 0

**Checkpoint**: All user stories are independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Refinements that affect multiple user stories

- [x] T026 [P] Add VS Code theme integration across all webview components in src/webview/: use --vscode-editor-background, --vscode-editor-foreground, --vscode-list-hoverBackground, and other CSS custom properties for full light/dark/high-contrast theme support
- [x] T027 [P] Add loading indicators: spinner during initial schema extraction in App.tsx, progress state during ELK layout computation in ErDiagram.tsx, loading state during data fetch in DataPreview.tsx
- [x] T028 Build extension and run quickstart.md validation checklist: verify dist/extension.js, dist/webview/index.js, dist/sql-wasm.wasm exist; test with sample database (3 tables with FKs, indexes, and sample data)
- [x] T029 Package extension as .vsix using vsce package for distribution

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories - **This is the MVP**
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Uses schema data loaded by the same SchemaProvider but no code dependency on US1 implementation
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Data query methods are independent; the "Preview Data" trigger from ER diagram context menu (T025) requires US2's ErDiagram to exist but can be wired last

### Within Each User Story

- SchemaProvider changes before webview component changes (data must flow before UI renders)
- Core component before interaction features (render table before adding sort)
- File paths in each task indicate the file boundary - [P] tasks touch different files

### Parallel Opportunities

- **Phase 1**: T002 and T003 can run in parallel (tsconfig and esbuild are independent files)
- **Phase 2**: T005 and T006 can run in parallel (sqliteService.ts and webview/ are independent)
- **Phase 3 (US1)**: T009 is package.json only, can run in parallel with T010-T015
- **Phase 4 (US2)**: T016 (TableNode) can run in parallel with any prior US1 tasks
- **Phase 5 (US3)**: T020 (sqliteService data methods) can run in parallel with T022 (DataPreview component)
- **Cross-story**: Once Phase 2 completes, US1/US2/US3 implementation tasks on different files can overlap

---

## Parallel Example: User Story 1

```bash
# After Phase 2 completes, launch US1 tasks on separate files:
Task: "T009 - Register custom editor in package.json"
Task: "T012 - Implement SchemaTree.tsx"
# These touch different files and can run concurrently

# Then sequentially:
Task: "T010 - Complete SchemaProvider database loading" (needs T009 for editor registration)
Task: "T011 - Implement App.tsx view router" (needs T010 for schema-loaded message)
```

## Parallel Example: User Story 2

```bash
# T016 can start as soon as Phase 2 is done (independent component):
Task: "T016 - Implement TableNode.tsx custom ReactFlow node"

# Then:
Task: "T017 - Implement ErDiagram.tsx with ReactFlow + ELK" (depends on T016)
Task: "T018 - Add Show ER Diagram button and view switching" (depends on T017)
Task: "T019 - Add table interaction" (depends on T017)
```

## Parallel Example: User Story 3

```bash
# These touch different files and can run concurrently:
Task: "T020 - Add data query methods to sqliteService.ts"
Task: "T022 - Implement DataPreview.tsx component"

# Then sequentially:
Task: "T021 - Add request-data message handling in schemaProvider" (depends on T020)
Task: "T023 - Add pagination controls" (depends on T022)
Task: "T024 - Add column sorting" (depends on T022)
Task: "T025 - Add Preview Data trigger" (depends on T022, T017 for ER context menu)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Click a .db file → schema tree renders with tables, columns, indexes
5. Deploy/demo if ready — this alone is a useful schema browser

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → MVP! (schema browser)
3. Add User Story 2 → Test independently → ER diagram adds visual value
4. Add User Story 3 → Test independently → Data preview completes the experience
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (schema tree)
   - Developer B: User Story 2 (ER diagram - can build TableNode.tsx and ErDiagram.tsx)
   - Developer C: User Story 3 (data preview - can build sqliteService data methods and DataPreview.tsx)
3. Stories integrate via shared types and message contracts

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate the story independently
- All SQL queries use quoted identifiers from schema metadata, not user input (security)
- Bundle budget: <5 MB total (~2.3 MB estimated)
- Performance targets: SC-001 (<3s schema load), SC-002 (<3s ER render), SC-003 (<200ms search), SC-005 (<2s data preview)
