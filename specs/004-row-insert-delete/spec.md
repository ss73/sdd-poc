# Feature Specification: Row Insert and Delete

**Feature Branch**: `004-row-insert-delete`
**Created**: 2026-02-12
**Status**: Draft
**Input**: User description: "I want to add row insertion and deletion to the data grid"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Delete a Row (Priority: P1)

A user is previewing a table in the data grid and sees a row they want to remove. They select the row and trigger a delete action. The system asks for confirmation, then removes the row from the database and refreshes the grid.

**Why this priority**: Deleting incorrect or unwanted data is the most common row-level operation and the simplest to implement — it requires no form input, just identification of the target row and a confirmation step.

**Independent Test**: Can be fully tested by opening a database, selecting a row, deleting it, and verifying the row is gone after reloading the database.

**Acceptance Scenarios**:

1. **Given** a table is displayed in the data grid, **When** the user clicks a row to select it, **Then** the row is visually highlighted as selected.
2. **Given** a row is selected, **When** the user triggers the delete action, **Then** a confirmation prompt appears showing which row will be deleted.
3. **Given** the confirmation prompt is displayed, **When** the user confirms deletion, **Then** the row is removed from the database and the grid refreshes to reflect the change.
4. **Given** the confirmation prompt is displayed, **When** the user cancels, **Then** no changes are made and the row remains selected.
5. **Given** a row is selected in a read-only database, **When** the user views the available actions, **Then** the delete action is disabled or hidden.
6. **Given** multiple rows are visible, **When** the user selects a different row, **Then** the previous selection is cleared and the new row is highlighted.

---

### User Story 2 - Insert a New Row (Priority: P2)

A user wants to add a new record to a table. They trigger an insert action, which adds an empty row at the bottom of the current view. The user fills in the cell values using the existing inline editing feature (from feature 003) and the row is persisted to the database when values are committed.

**Why this priority**: Inserting data is essential for a complete data management experience, but it depends on the existing cell editing infrastructure and is more complex than deletion (requires handling default values, auto-increment PKs, and constraint validation across multiple columns).

**Independent Test**: Can be tested by opening a database, triggering the insert action, filling in values for each column, and verifying the new row persists after reloading the database.

**Acceptance Scenarios**:

1. **Given** a table is displayed in the data grid, **When** the user triggers the insert action, **Then** a new empty row appears at the bottom of the current page with all editable cells ready for input.
2. **Given** a new row is being composed, **When** the user fills in cell values and confirms, **Then** the row is inserted into the database with the provided values.
3. **Given** a new row is being composed, **When** the user leaves a column with a default value empty, **Then** the database default value is used for that column.
4. **Given** a new row is being composed, **When** the user triggers cancel or presses Escape while no values have been entered, **Then** the empty row is removed without persisting anything.
5. **Given** a table has an auto-increment primary key, **When** the user inserts a new row, **Then** the primary key column is not editable and is automatically assigned by the database.
6. **Given** a new row is being composed, **When** the user submits values that violate a constraint (NOT NULL, UNIQUE, FK), **Then** an inline error is displayed and the row remains editable.
7. **Given** the database is read-only or has pending external changes, **When** the user views the available actions, **Then** the insert action is disabled.

---

### User Story 3 - Delete Feedback and Error Handling (Priority: P3)

When a delete operation fails — for example, because another table has foreign key references to the row — the system displays a clear error message explaining why the row cannot be deleted and what the user can do about it.

**Why this priority**: Error handling for deletion is important for a robust experience, but the happy path (successful delete) is more critical to ship first.

**Independent Test**: Can be tested by attempting to delete a row that is referenced by a foreign key in another table and verifying that a clear error message appears.

**Acceptance Scenarios**:

1. **Given** a row is referenced by rows in another table via a foreign key, **When** the user confirms deletion, **Then** an error message is displayed explaining that other records depend on this row.
2. **Given** the database is locked by another process, **When** the user confirms deletion, **Then** an error message is displayed explaining that the database is currently locked.
3. **Given** a delete operation fails for any reason, **When** the error is displayed, **Then** the row remains in the grid unchanged and the selection is preserved.

---

### Edge Cases

- What happens when the user deletes the last row on a page? The system should navigate to the previous page if available, or show the empty table state.
- What happens when the user tries to delete a row from a table without a primary key (using implicit rowid)? The system should use the same row identification strategy as inline editing (rowid fallback).
- What happens when the user inserts a row into a table with no editable columns (all columns are PKs or BLOBs)? The insert action should be disabled for such tables.
- What happens when an insert is cancelled after some values have been entered? The system should confirm before discarding partially filled rows.
- What happens when the user inserts a row into a WITHOUT ROWID table without an explicit primary key? The insert action should be disabled (consistent with editing being disabled for these tables).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to select a single row in the data grid by clicking on it.
- **FR-002**: System MUST visually highlight the currently selected row.
- **FR-003**: System MUST provide a delete action for the selected row (button or context menu).
- **FR-004**: System MUST display a confirmation prompt before deleting a row.
- **FR-005**: System MUST remove the row from the database and refresh the grid upon confirmed deletion.
- **FR-006**: System MUST provide an insert action to add a new empty row to the table (button in toolbar).
- **FR-007**: System MUST display a new empty row at the bottom of the current page when insert is triggered.
- **FR-008**: System MUST allow the user to fill in cell values in the new row using the existing inline editing controls.
- **FR-009**: System MUST persist the new row to the database when the user commits the values.
- **FR-010**: System MUST allow the user to cancel row insertion, removing the uncommitted row from the grid.
- **FR-011**: System MUST display inline error messages when insert or delete operations fail due to constraint violations.
- **FR-012**: System MUST disable insert and delete actions when the database is read-only, locked, or has pending external changes.
- **FR-013**: System MUST handle auto-increment primary key columns automatically during insertion (not user-editable).
- **FR-014**: System MUST clear the row selection when the user navigates to a different page or changes sort order.

### Key Entities

- **Row Selection**: The currently selected row in the data grid, identified by its row index within the current page and its row identifier (PK or rowid values).
- **New Row**: A transient row being composed in the data grid, not yet persisted to the database.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can delete a row and see the updated grid in under 2 seconds end-to-end.
- **SC-002**: Users can insert a new row and have it persisted in under 5 seconds (including filling in values).
- **SC-003**: 95% of first-time users can successfully delete a row without documentation or guidance.
- **SC-004**: Constraint violation errors during insert or delete are displayed within 1 second.
- **SC-005**: Zero data loss — every confirmed delete is correctly applied, and no accidental deletions occur without confirmation.

## Assumptions

- The existing inline cell editing infrastructure (feature 003) is available and working, including parameterized queries, row identification, constraint error parsing, and the isWritingBack file watcher flag.
- Row selection is single-select only — multi-row selection and bulk operations are out of scope for this feature.
- The insert workflow reuses the existing cell edit UI — no new form or modal is needed.
- Tables where editing is disabled (WITHOUT ROWID without PK, read-only files) also have insert and delete disabled.
- The confirmation prompt for deletion uses a simple inline confirmation within the data grid (not a VS Code modal dialog), consistent with the extension's existing UX patterns.
