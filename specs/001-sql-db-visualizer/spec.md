# Feature Specification: SQL Database Visualizer

**Feature Branch**: `001-sql-db-visualizer`
**Created**: 2026-02-11
**Status**: Draft
**Input**: User description: "Visual Studio Code plugin to visualize SQL databases"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open and Browse Database Schema (Priority: P1)

A developer with a SQLite database file in their project wants to click
the file in the VS Code file explorer and immediately see the database
schema (tables, columns, data types, constraints, indexes) in a
structured view — no setup, no connection dialogs, no configuration.

**Why this priority**: This is the entry point to the entire extension.
Without the ability to open a file and see its schema, no other feature
works. The zero-configuration, click-to-open model makes it immediately
useful on first install.

**Independent Test**: Can be fully tested by placing a SQLite file in a
workspace, clicking it in the explorer, and verifying the schema tree
renders with correct tables, columns, and indexes. Delivers value as a
standalone schema browser.

**Acceptance Scenarios**:

1. **Given** the extension is installed, **When** the user clicks a file
   with a `.db`, `.sqlite`, or `.sqlite3` extension in the file
   explorer, **Then** the extension opens a visual editor showing the
   database schema as a tree: tables > columns (with data type and
   constraint icons) and indexes.
2. **Given** the user clicks a SQLite file, **When** the file is not a
   valid SQLite database (corrupt or wrong format), **Then** the user
   sees a clear error message explaining the file could not be read as
   a database.
3. **Given** a database is open, **When** the user expands a table node
   in the tree, **Then** they see all columns with their data types,
   nullability, and key constraints (primary key, foreign key) plus an
   expandable indexes node listing all indexes on that table.
4. **Given** a database with many tables (100+), **When** the user types
   in the search/filter box above the tree, **Then** the tree filters
   to show only matching tables and columns in real time.
5. **Given** a database is open, **When** the user clicks a different
   SQLite file in the explorer, **Then** the new database replaces the
   previous one in the view (only one database open at a time).

---

### User Story 2 - Interactive ER Diagram (Priority: P2)

A developer wants to see a visual entity-relationship diagram of their
database to understand how tables relate to each other through foreign
keys. The diagram should be interactive: pannable, zoomable, and
clickable to navigate to table details.

**Why this priority**: The ER diagram is the core "visualize" feature
that differentiates this extension from a plain schema browser. It
transforms raw metadata into an intuitive visual map of the database
structure. Requires an open database file (US1) but delivers the primary
value proposition.

**Independent Test**: Can be tested by opening a SQLite file with at
least 3 tables that have foreign key relationships, triggering the ER
diagram view, and verifying all tables and relationships render correctly
with interactive controls.

**Acceptance Scenarios**:

1. **Given** a database file is open, **When** the user triggers the
   "Show ER Diagram" command, **Then** an interactive diagram opens in
   an editor tab showing all tables as boxes with their columns and
   lines connecting foreign key relationships.
2. **Given** an open ER diagram, **When** the user scrolls or
   pinch-zooms, **Then** the diagram pans and zooms smoothly.
3. **Given** an open ER diagram, **When** the user clicks on a table in
   the diagram, **Then** the table is highlighted and its details
   (columns, types, constraints) are shown in a tooltip or detail panel.
4. **Given** a database with many tables (50+), **When** the ER diagram
   opens, **Then** the layout automatically arranges tables to minimize
   crossing relationship lines and the diagram remains readable.
5. **Given** an open ER diagram, **When** the user right-clicks a table,
   **Then** they can choose to preview that table's data (linking to
   User Story 3) or copy the table name.

---

### User Story 3 - Table Data Preview (Priority: P3)

A developer wants to quickly preview the data inside a table without
writing a query, directly within VS Code. They can view rows in a
paginated, read-only grid with sortable columns.

**Why this priority**: Data preview completes the "visualize" experience
by letting users not only see structure but also peek at actual data.
It is lower priority because the core value ("visualize SQL databases")
is primarily about structure, not data browsing.

**Independent Test**: Can be tested by opening a SQLite file, selecting
a table, and verifying that a data grid opens showing rows with correct
values, pagination controls, and sortable column headers.

**Acceptance Scenarios**:

1. **Given** a database file is open and a table is selected in the tree,
   **When** the user triggers "Preview Data" on the table, **Then** a
   new editor tab opens showing the first 50 rows in a read-only grid
   with column headers.
2. **Given** an open data preview, **When** the user clicks a column
   header, **Then** the data sorts by that column (ascending, then
   descending on second click).
3. **Given** a table with more than 50 rows, **When** the user reaches
   the bottom of the current page, **Then** pagination controls allow
   them to navigate to the next page of results.
4. **Given** a table with NULL values, **When** the data preview renders,
   **Then** NULL values are visually distinct from empty strings.

---

### Edge Cases

- What happens when the database file becomes inaccessible mid-session
  (deleted, moved, or locked by another process)? The extension shows a
  notification and displays a "Database unavailable" overlay in open
  views rather than crashing.
- What happens when a table has no columns (empty or corrupted schema)?
  The table is still shown in the tree with a "no columns" indicator.
  The ER diagram renders it as an empty box. Data preview shows an empty
  state.
- What happens when the database has no tables?
  The tree view shows a "No tables found" message. The ER diagram
  command shows a friendly empty state.
- What happens when foreign key relationships form circular references?
  The ER diagram renders all relationships without infinite loops; the
  layout algorithm handles cycles gracefully.
- What happens when the file has a recognized extension but is not
  actually a SQLite database? The extension shows a clear error message
  indicating the file format is not valid and does not crash.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Extension MUST register as a custom editor for `.db`,
  `.sqlite`, and `.sqlite3` file extensions so that clicking these files
  in the explorer opens the database visualizer.
- **FR-002**: Extension MUST display the database schema as an
  expandable tree view: tables > columns (showing data type and
  constraints) and indexes (as a separate expandable node under each
  table).
- **FR-003**: Extension MUST provide a search/filter capability in the
  schema tree that filters tables and columns by name in real time.
- **FR-004**: Extension MUST render an interactive entity-relationship
  diagram showing tables and their foreign key connections in an editor
  tab.
- **FR-005**: The ER diagram MUST support pan, zoom, click-to-select,
  and automatic layout of tables.
- **FR-006**: Extension MUST provide a read-only data preview for any
  table, showing rows in a paginated grid (default 50 rows per page).
- **FR-007**: Data preview MUST support column sorting (ascending and
  descending).
- **FR-008**: Extension MUST support only one open database at a time.
  Clicking a new SQLite file replaces the current view.
- **FR-009**: Extension MUST show user-actionable error messages when a
  file cannot be opened (not a valid SQLite file, permission denied,
  file locked).
- **FR-010**: Extension MUST support SQLite databases as the sole
  database engine in the initial release.
- **FR-011**: Extension MUST detect when an open database file becomes
  inaccessible and notify the user with guidance on how to resolve the
  issue.
- **FR-012**: NULL values in data preview MUST be visually distinct from
  empty strings.

### Key Entities

- **Database Schema**: The structural metadata of an opened SQLite file.
  Contains tables, each with columns and indexes. Columns have a name,
  data type, nullability, and constraint flags (primary key, foreign
  key, unique). Indexes have a name, indexed columns, and uniqueness
  flag.
- **Table Relationship**: A foreign key link between two tables.
  Attributes: source table, source column, target table, target column,
  relationship type (one-to-one, one-to-many, many-to-many).
- **Data Page**: A paginated subset of rows from a table. Attributes:
  rows, page number, total row count, sort column, sort direction.

## Clarifications

### Session 2026-02-11

- Q: Can users export the ER diagram as a static image (PNG/SVG)? → A: Export is out of scope for v1 (view-only in editor).
- Q: Can multiple databases be open simultaneously? → A: Only one database open at a time; clicking a new file replaces the current view.
- Q: Should indexes be visible in the schema tree? → A: Yes, as a separate expandable node under each table (table > columns, indexes).
- Q: How do users open a database? → A: Click a `.db`/`.sqlite`/`.sqlite3` file in the file explorer. No connection profiles or setup required.

## Assumptions

- The extension is read-only; it does not support writing, modifying, or
  deleting data in the database.
- Users are developers who have SQLite files in their project workspace.
- The extension does not provide a SQL query editor; it only provides
  visual browsing and ER diagrams.
- The ER diagram shows only tables and foreign key relationships; views,
  stored procedures, and triggers are out of scope for this version.
- ER diagram export (PNG, SVG, clipboard) is out of scope for v1; the
  diagram is view-only within the editor.
- SQLite is the only supported database engine; network-based databases
  (PostgreSQL, MySQL, SQL Server) are out of scope for this version.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can go from clicking a SQLite file to seeing its
  schema in the tree view within 3 seconds (no setup steps required).
- **SC-002**: The ER diagram renders and becomes interactive within
  3 seconds for databases with up to 100 tables.
- **SC-003**: Schema tree search returns filtered results within 200ms
  of the user typing, for databases with up to 500 tables.
- **SC-004**: 95% of first-time users successfully view a database
  schema on their first attempt without consulting documentation.
- **SC-005**: Data preview loads the first page of results within
  2 seconds for tables with up to 1 million rows.
- **SC-006**: The extension activates and is ready for use within
  1 second of the editor starting.
- **SC-007**: File errors present a user-actionable message in 100% of
  failure scenarios (no raw error dumps).
