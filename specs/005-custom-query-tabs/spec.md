# Feature Specification: Custom Query Tabs

**Feature Branch**: `005-custom-query-tabs`
**Created**: 2026-02-12
**Status**: Draft
**Input**: User description: "I want to be able to run custom queries. I should be able to have multiple queries in separate tabs. Queries don't have to be persisted if I close the viewer"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run a Custom Query (Priority: P1)

A user is exploring a SQLite database and wants to run an ad-hoc SQL query to inspect data, perform joins, or aggregate results that the basic table preview cannot provide. They open a query tab, type a SQL statement, execute it, and see the results displayed in a tabular format below the editor.

**Why this priority**: Running a single custom query is the core value of this feature. Without this, none of the other stories matter. A single query tab that executes SQL and shows results delivers immediate utility.

**Independent Test**: Can be fully tested by opening a database, opening a query tab, typing a SELECT query, executing it, and verifying the results appear in a table.

**Acceptance Scenarios**:

1. **Given** a database is open, **When** the user opens a new query tab, **Then** an empty text area appears where they can type SQL.
2. **Given** a query tab is open with a SQL statement, **When** the user triggers execution (button or keyboard shortcut), **Then** the query runs against the open database and results appear in a table below the editor.
3. **Given** a SELECT query has been executed, **When** the results are displayed, **Then** column headers and row data are shown in a scrollable, paginated table consistent with the existing data preview appearance.
4. **Given** a query contains a syntax error or references a non-existent table, **When** the user executes it, **Then** a clear error message is displayed instead of results.
5. **Given** a query modifies data (INSERT, UPDATE, DELETE), **When** the user executes it, **Then** the system reports how many rows were affected and does not display a result table.
6. **Given** a query tab is open, **When** the user has not yet executed any query, **Then** the results area shows an empty state with a hint (e.g., "Run a query to see results").

---

### User Story 2 - Multiple Query Tabs (Priority: P2)

A user wants to work on multiple queries simultaneously — for example, a complex join in one tab and a quick lookup in another. They can open additional query tabs, switch between them, and each tab retains its own query text and results independently.

**Why this priority**: Multiple tabs allow users to compare results and iterate on different queries without losing context. This builds directly on US1 and adds significant productivity value.

**Independent Test**: Can be tested by opening two or more query tabs, writing different queries in each, executing them, and switching between tabs to verify each retains its own query and results.

**Acceptance Scenarios**:

1. **Given** one query tab is already open, **When** the user opens another query tab, **Then** a new tab appears with its own empty editor and results area.
2. **Given** multiple query tabs are open, **When** the user switches between tabs, **Then** each tab displays its own query text and results (or empty state if not yet executed).
3. **Given** multiple query tabs are open, **When** the user closes one tab, **Then** only that tab is removed and the others remain unaffected.
4. **Given** multiple query tabs are open, **When** the user closes the entire database viewer, **Then** all query tabs and their contents are discarded without any save prompt.
5. **Given** multiple tabs are open, **When** the user views the tab bar, **Then** each query tab has a distinguishable label (e.g., "Query 1", "Query 2") and a close button.

---

### User Story 3 - Query Results Interaction (Priority: P3)

A user has executed a query and wants to work with the results — sorting columns, scrolling through large result sets, or seeing NULL and data type indicators consistent with the existing data preview.

**Why this priority**: Enhanced result interaction improves usability for complex queries that return many rows or columns, but the basic display from US1 is sufficient for an MVP.

**Independent Test**: Can be tested by running a query that returns many rows, verifying pagination works, clicking column headers to sort, and confirming NULL values display consistently with the data preview.

**Acceptance Scenarios**:

1. **Given** query results contain more rows than fit on one page, **When** the results are displayed, **Then** pagination controls appear allowing the user to navigate through pages.
2. **Given** query results are displayed, **When** the user clicks a column header, **Then** the results are sorted by that column (the sort happens on the already-fetched result set, not by re-running the query).
3. **Given** query results contain NULL values, **When** they are displayed, **Then** they show the same "NULL" indicator used in the data preview.
4. **Given** query results contain BLOB values, **When** they are displayed, **Then** they show the same "(BLOB)" indicator used in the data preview.

---

### Edge Cases

- What happens when the user runs a query that returns zero rows? The system should display the column headers with an empty table and a "No results" message.
- What happens when the user runs multiple statements separated by semicolons? The system should execute only the first statement and ignore the rest, or display an informative message.
- What happens when a query takes a long time to execute? The system should show a loading indicator and not freeze the interface.
- What happens when the database is modified externally while a query tab is open? The existing "database changed" notification should still appear, but existing query results should remain visible (they are a snapshot).
- What happens when the user tries to open a query tab on a database that failed to load? The query tab option should not be available.
- What happens when the user runs a DDL statement (CREATE TABLE, DROP TABLE)? The system should report success and the schema tree should reflect the change on reload.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a way to open a new query tab from the main interface.
- **FR-002**: System MUST display a text input area where the user can type SQL statements.
- **FR-003**: System MUST provide an execute action (button and keyboard shortcut) to run the current query.
- **FR-004**: System MUST display query results in a tabular format with column headers and row data.
- **FR-005**: System MUST display a clear error message when a query fails (syntax error, missing table, constraint violation).
- **FR-006**: System MUST report the number of affected rows for data modification queries (INSERT, UPDATE, DELETE).
- **FR-007**: System MUST support multiple simultaneous query tabs, each with independent query text and results.
- **FR-008**: System MUST allow users to close individual query tabs.
- **FR-009**: System MUST discard all query tabs and their contents when the database viewer is closed (no persistence required).
- **FR-010**: System MUST label each query tab distinctly (e.g., sequential numbering).
- **FR-011**: System MUST paginate query results for large result sets.
- **FR-012**: System MUST display NULL and BLOB values consistently with the existing data preview.
- **FR-013**: System MUST show a loading indicator while a query is executing.
- **FR-014**: System MUST disable the execute action while a query is already running.

### Key Entities

- **Query Tab**: A transient workspace containing a SQL statement and its execution results. Identified by a sequential label. Not persisted beyond the current session.
- **Query Result**: The output of executing a SQL statement — either a set of rows and columns (for SELECT), an affected row count (for INSERT/UPDATE/DELETE/DDL), or an error message.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can write and execute a SQL query and see results in under 3 seconds (for queries returning up to 1000 rows).
- **SC-002**: Users can open, switch between, and close at least 10 query tabs without interface degradation.
- **SC-003**: 90% of first-time users can successfully run a query without external guidance.
- **SC-004**: Query error messages are specific enough for users to identify and fix the issue on the next attempt.
- **SC-005**: Query results display is visually consistent with the existing data preview — users cannot distinguish between a table preview and query results at a glance.

## Assumptions

- Query tabs are fully transient — no auto-save, no persistence, no prompt on close. This is explicitly requested by the user.
- The text input area is a plain text area (not a full code editor with syntax highlighting). Syntax highlighting may be added as a future enhancement but is not in scope.
- Queries run against the currently open database only. There is no ability to switch databases within a query tab.
- Query results are read-only. Inline editing of query result cells is not supported (the user can use the table preview for that).
- Only one statement per execution is supported. If the user enters multiple semicolon-separated statements, only the first is executed.
- The query tab feature is available alongside the existing schema tree, ER diagram, and data preview — it does not replace any existing views.
