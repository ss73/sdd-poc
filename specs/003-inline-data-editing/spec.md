# Feature Specification: Inline Data Editing

**Feature Branch**: `003-inline-data-editing`
**Created**: 2026-02-12
**Status**: Draft
**Input**: User description: "I would like to be able to edit values in the data grid directly."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Edit a Single Cell Value (Priority: P1)

A user opens a SQLite database and previews a table in the data grid. They see a value they want to change — perhaps a misspelled name or an incorrect number. They click (or double-click) on the cell, the cell becomes an editable text input, they type the new value, and press Enter to confirm. The change is written to the database file immediately and the cell returns to its read-only display state showing the updated value.

**Why this priority**: This is the core interaction — without the ability to edit and save a single cell, no other editing features matter.

**Independent Test**: Can be fully tested by opening a database, double-clicking a cell, changing its value, pressing Enter, and verifying the new value persists after reloading the database.

**Acceptance Scenarios**:

1. **Given** a table is displayed in the data grid, **When** the user double-clicks a cell, **Then** the cell becomes an editable text input pre-filled with the current value.
2. **Given** a cell is in edit mode, **When** the user types a new value and presses Enter, **Then** the value is saved to the database and the cell returns to read-only display with the updated value.
3. **Given** a cell is in edit mode, **When** the user presses Escape, **Then** the edit is cancelled and the original value is restored.
4. **Given** a cell is in edit mode, **When** the user clicks outside the cell, **Then** the edit is committed (same as pressing Enter).
5. **Given** a cell contains a NULL value, **When** the user double-clicks it, **Then** the input is empty and ready for a new value.

---

### User Story 2 - Edit Feedback and Error Handling (Priority: P2)

When a user attempts to save an edit that violates a database constraint (e.g., NOT NULL, UNIQUE, type mismatch, foreign key), they receive a clear inline error message near the cell explaining what went wrong. The cell remains in edit mode so they can correct the value or cancel.

**Why this priority**: Without error feedback, users would not know why their edits fail, leading to frustration and potential data confusion.

**Independent Test**: Can be tested by attempting to set a NOT NULL column to empty, or entering a duplicate value in a UNIQUE column, and verifying an error message appears.

**Acceptance Scenarios**:

1. **Given** a cell is in edit mode for a NOT NULL column, **When** the user clears the value and presses Enter, **Then** an error message is displayed indicating the column cannot be empty.
2. **Given** a cell is in edit mode for a UNIQUE column, **When** the user enters a value that already exists, **Then** an error message is displayed indicating the value must be unique.
3. **Given** a cell is in edit mode for a foreign key column, **When** the user enters a value that does not exist in the referenced table, **Then** an error message is displayed indicating the value must match an existing record in the referenced table.
4. **Given** a cell is in edit mode for a column whose value is referenced by rows in another table, **When** the user changes the value and presses Enter, **Then** an error message is displayed indicating the value cannot be changed because other records depend on it.
5. **Given** a save fails for any reason, **When** the error is displayed, **Then** the cell remains in edit mode so the user can correct the value or press Escape to cancel.
6. **Given** an error message is displayed, **When** the user begins typing a new value, **Then** the error message is dismissed.

*Note: Scenario 4 applies to non-primary-key columns that are referenced by foreign keys (e.g., UNIQUE columns). Primary key columns are already non-editable per FR-008.*

---

### User Story 3 - Set a Cell to NULL (Priority: P3)

A user wants to explicitly set a nullable column's value to NULL (as opposed to an empty string). While in edit mode, a clear mechanism is available to set the value to NULL, distinct from clearing the text input.

**Why this priority**: Distinguishing NULL from empty string is important for database correctness, but it's a secondary concern after basic editing works.

**Independent Test**: Can be tested by editing a nullable cell, using the NULL mechanism, saving, and verifying the cell displays the NULL indicator (not an empty string).

**Acceptance Scenarios**:

1. **Given** a cell is in edit mode on a nullable column, **When** the user activates the "Set NULL" action, **Then** the value is saved as database NULL and the cell displays the existing NULL indicator styling.
2. **Given** a cell is in edit mode on a NOT NULL column, **When** the user views the edit controls, **Then** no "Set NULL" action is available.

---

### Edge Cases

- What happens when the user edits a cell in a table with no primary key? The system should identify rows by rowid (SQLite always has an implicit rowid unless it's a WITHOUT ROWID table).
- What happens when the database file is locked or read-only on disk? The system should display an error and prevent entering edit mode.
- What happens when another process modifies the database while the user is editing? SQLite's built-in file locking handles concurrent access. If another process holds a write lock, the edit fails with a SQLITE_BUSY error surfaced as an inline message. The file watcher detects external changes and blocks further editing until the user reloads.
- What happens when the user edits a cell with a very long text value? The input should handle long values gracefully (scrollable input, no layout breakage).
- What happens when the user edits a BLOB column? BLOB cells should not be editable (display a non-editable indicator).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to enter edit mode on a cell by double-clicking it.
- **FR-002**: System MUST display an editable text input pre-filled with the cell's current value when in edit mode.
- **FR-003**: System MUST save the edited value to the database file when the user confirms (Enter or click-away).
- **FR-004**: System MUST cancel the edit and restore the original value when the user presses Escape.
- **FR-005**: System MUST display an inline error message when a save fails due to a database constraint violation.
- **FR-006**: System MUST keep the cell in edit mode after a failed save so the user can correct the value.
- **FR-007**: System MUST provide a mechanism to set a nullable cell's value to NULL, distinct from setting it to an empty string.
- **FR-008**: System MUST prevent editing of BLOB columns and primary key columns.
- **FR-009**: System MUST prevent entering edit mode when the database file is read-only, locked, or has been modified externally since last load (i.e., a pending reload is required).
- **FR-010**: System MUST refresh the displayed data after a successful edit to reflect the current database state.
- **FR-011**: System MUST visually indicate which cell is currently in edit mode (e.g., highlighted border, different background).

### Key Entities

- **Cell Edit**: Represents an in-progress edit — the target table, column, row identifier, original value, and new value.
- **Row Identifier**: The mechanism used to uniquely identify the row being edited (primary key value or SQLite rowid).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can edit a cell value and see the saved result in under 2 seconds end-to-end.
- **SC-002**: 95% of first-time users can successfully edit a cell without documentation or guidance.
- **SC-003**: Constraint violation errors are displayed within 1 second of the user confirming the edit.
- **SC-004**: Zero data corruption — every saved edit is verified to be correctly persisted in the database file.

## Assumptions

- SQLite databases opened in this extension are small-to-medium sized (typical development/testing databases), so writing changes synchronously is acceptable.
- Users expect edits to be committed immediately (no batch/transaction mode needed for this feature).
- The existing data grid pagination and sorting behavior is preserved during and after edits.
- WITHOUT ROWID tables are rare in typical usage; if encountered, editing is disabled for tables where rows cannot be uniquely identified.
