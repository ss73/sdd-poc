# Feature Specification: Export to CSV for Result Sets

**Feature Branch**: `006-export-csv`  
**Created**: 2026-02-19  
**Status**: Draft  
**Input**: User description: "add export to csv for resultsets"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Export Query Results to CSV (Priority: P1)

A user has run a custom SQL query in a query tab and wants to export the result set to a CSV file for further analysis in a spreadsheet application or data pipeline. They click an "Export to CSV" button, choose a save location, and a well-formed CSV file is written to disk containing all result rows and column headers.

**Why this priority**: Exporting query results is the core value of this feature. A single export action for a query result set delivers the full MVP and all other stories build on it.

**Independent Test**: Can be fully tested by opening a database, running a SELECT query in a query tab, clicking "Export to CSV", saving the file, and verifying the file contains column headers and all result rows in valid CSV format.

**Acceptance Scenarios**:

1. **Given** a query has been executed and results are visible, **When** the user clicks "Export to CSV", **Then** a save-file dialog appears prompting for a file name and location.
2. **Given** the user confirms a file path, **When** the file is written, **Then** the first row of the CSV contains the column headers matching the result set, and subsequent rows contain the data values.
3. **Given** the export completes successfully, **When** the file is saved, **Then** the system shows a success notification (e.g., "Exported N rows to file.csv").
4. **Given** a query has not yet been executed or returned an error, **When** the user views the query tab, **Then** the "Export to CSV" button is disabled or absent.
5. **Given** the user cancels the save-file dialog, **When** the dialog is dismissed, **Then** no file is written and the interface returns to its previous state.

---

### User Story 2 - Export Table Preview to CSV (Priority: P2)

A user is browsing the contents of a table in the data preview panel and wants to export that table's data to CSV without writing a custom query. They click "Export to CSV" in the table preview, and the full table data (not just the current page) is written to a CSV file.

**Why this priority**: Table preview export covers the most common case where users want a quick full-table dump without writing SQL. It reuses the same export mechanism as US1 and significantly broadens the feature's utility.

**Independent Test**: Can be tested by selecting a table in the schema tree, viewing its data preview, clicking "Export to CSV", and verifying the output file contains all rows (across all pages) and the correct column headers.

**Acceptance Scenarios**:

1. **Given** a table is displayed in the data preview panel, **When** the user clicks "Export to CSV", **Then** a save-file dialog appears.
2. **Given** the user confirms a file path, **When** the file is written, **Then** the CSV contains ALL rows from the table (not just the currently visible page), with the first row as column headers.
3. **Given** the export completes successfully, **When** the file is saved, **Then** a success notification shows how many rows were exported.
4. **Given** a table is empty, **When** the user exports to CSV, **Then** the file contains only the header row and no data rows.

---

### User Story 3 - Correct CSV Formatting (Priority: P3)

A user opens the exported CSV in a spreadsheet application (e.g., Excel, LibreOffice Calc, Numbers) and expects the file to open without errors. Values containing commas, quotes, or newlines are correctly escaped so the file parses correctly.

**Why this priority**: Without correct CSV escaping, exported files may be unusable in common tools. This story codifies the formatting requirements that make the export actually reliable.

**Independent Test**: Can be tested by exporting a result set that contains values with embedded commas, double-quote characters, and newline characters, then opening the CSV in a spreadsheet application and verifying the data integrity.

**Acceptance Scenarios**:

1. **Given** a result value contains a comma, **When** exported, **Then** that value is enclosed in double quotes in the CSV output.
2. **Given** a result value contains a double-quote character, **When** exported, **Then** the double quote is escaped by doubling it (`""`).
3. **Given** a result value contains a newline character, **When** exported, **Then** that value is enclosed in double quotes.
4. **Given** a result value is NULL, **When** exported, **Then** the CSV cell is empty (no text, not the string "NULL").
5. **Given** a result value is a BLOB, **When** exported, **Then** the CSV cell contains the placeholder text `(BLOB)`.
6. **Given** the CSV file is opened in Excel or LibreOffice Calc, **When** parsing, **Then** all columns and rows align correctly with no data spillover between cells.

---

### Edge Cases

- What happens when the result set is very large (e.g., hundreds of thousands of rows)? The export streams or batches the write to avoid memory exhaustion; a progress notification with a cancel button is shown throughout.
- What happens when the file cannot be written (e.g., permission denied, disk full)? The system displays an error notification with the reason, and any partially written file is deleted automatically.
- What happens when the user cancels an in-progress export? The export stops immediately and the partially written file is deleted, leaving no trace on disk.
- What happens if the chosen file path already exists? The native OS save dialog handles it — it displays its own overwrite confirmation before the export begins; the extension does not add a second prompt.
- What happens when column names contain commas or special characters? Column header names are escaped using the same rules as data values.
- What happens when the result set has zero rows? A CSV with only the header row is written and the success notification indicates 0 rows exported.
- What happens when a query returns duplicate column names? Each header is included as-is; deduplication is not attempted.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide an "Export to CSV" toolbar button above the result table in the query tab.
- **FR-002**: System MUST provide an "Export to CSV" toolbar button above the result table in the data preview panel.
- **FR-003**: The "Export to CSV" button MUST be disabled when no result set is available (query not yet run, query errored, or no table selected).
- **FR-004**: System MUST open a native save-file dialog to allow the user to choose the file name and destination directory; the default file name SHOULD be derived from the query tab label or table name. Overwrite confirmation for existing files is delegated to the native dialog.
- **FR-005**: The exported CSV MUST include column headers as the first row.
- **FR-006**: The exported CSV MUST include all rows of the result set, not just the currently paginated page.
- **FR-007**: System MUST escape values containing commas, double-quote characters, or newlines according to RFC 4180 CSV formatting rules.
- **FR-008**: NULL values MUST be represented as an empty field (no content between delimiters).
- **FR-009**: BLOB values MUST be represented as the literal text `(BLOB)`.
- **FR-010**: CSV files MUST use CRLF (`\r\n`) line endings throughout (strict RFC 4180).
- **FR-011**: System MUST display a progress notification with a cancel button during export; the notification MUST update as rows are written.
- **FR-012**: When the user cancels an in-progress export, the system MUST stop writing and delete the partial file, leaving no file on disk.
- **FR-013**: When an export fails mid-write (e.g., disk full, permission error), the system MUST delete the partial file and display an error notification with the reason.
- **FR-014**: System MUST display a success notification after a completed export, including the number of rows written and the file path.
- **FR-015**: System MUST handle cancellation of the save-file dialog gracefully, leaving the interface unchanged and writing no file.

### Key Entities

- **Result Set**: The output of a successfully executed SELECT query or a table preview — a collection of named columns and zero or more data rows. This is the source of the CSV export.
- **CSV Export**: A file written to disk containing a header row and one row per result set row, formatted according to RFC 4180.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can export a query result set or table preview to a CSV file in under 5 seconds for result sets up to 10,000 rows.
- **SC-002**: Exported CSV files open correctly in Excel, LibreOffice Calc, and Numbers without any parsing errors for all supported data types (text, integer, real, NULL, BLOB).
- **SC-003**: 90% of users can successfully export a result set to CSV on their first attempt without external guidance.
- **SC-004**: Exported CSV files contain exactly the same number of rows as the result set (verified by row count in the success notification vs. row count in a spreadsheet application).

## Assumptions

- Export scope is the full result set, not just the currently visible page. For table preview exports, this means all rows in the table are fetched and written, even if the preview only shows a page at a time.
- The CSV delimiter is a comma (`,`) and the file encoding is UTF-8 with no BOM.
- CSV line endings are always CRLF (`\r\n`), regardless of platform, in strict compliance with RFC 4180.
- There is no column selection UI in scope — all columns are always exported.
- There is no row filtering or sorting UI for the export — rows are exported in the order returned by the query or table fetch.
- The export is a one-shot operation; there is no scheduled or recurring export in scope.
