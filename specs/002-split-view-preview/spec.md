# Feature Specification: Split View Data Preview

**Feature Branch**: `002-split-view-preview`
**Created**: 2026-02-11
**Status**: Draft
**Input**: User description: "Revisit UX: Selected table in schema tree should split window horizontally and show the preview data to the right of the tree"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Split Pane Layout for Table Selection (Priority: P1)

A developer browsing a SQLite database schema wants to click a table in
the schema tree and immediately see its data in a preview panel to the
right — without leaving the schema tree. The window splits horizontally
into two panes: the schema tree stays on the left, and the data preview
appears on the right. This allows the developer to browse multiple
tables in sequence without constantly switching between full-screen views.

**Why this priority**: This is the core UX change. The current behavior
replaces the entire view when previewing data, forcing the user to
navigate back to the schema tree each time. A persistent split layout
is the primary improvement this feature delivers.

**Independent Test**: Open a SQLite file, click any table in the schema
tree, and verify the window splits into schema tree (left) and data
preview (right). Click a different table and verify the data preview
updates. Verify the schema tree remains visible and interactive
throughout.

**Acceptance Scenarios**:

1. **Given** a database is open and the schema tree is visible, **When**
   the user clicks a table name in the tree, **Then** the view splits
   into two panes: the schema tree on the left and the data preview for
   the selected table on the right.
2. **Given** the split view is active with a table's data showing,
   **When** the user clicks a different table in the schema tree, **Then**
   the right pane updates to show the newly selected table's data.
3. **Given** the split view is active, **When** the user looks at the
   schema tree, **Then** the currently previewed table is visually
   highlighted (selected state) in the tree.
4. **Given** the split view is active, **When** the user continues to
   interact with the schema tree (expanding/collapsing tables, searching),
   **Then** the tree behaves normally and the right pane is not affected.

---

### User Story 2 - Resizable Split Pane (Priority: P2)

A developer wants to adjust the relative size of the schema tree and
data preview panes to suit their screen size or preference. They can
drag the divider between the two panes to resize them.

**Why this priority**: Resizability improves usability across different
screen sizes and workflows, but the split layout is useful even with a
fixed ratio.

**Independent Test**: Open a database, click a table to activate the
split view, then drag the divider between panes. Verify both panes
resize smoothly and content reflows correctly.

**Acceptance Scenarios**:

1. **Given** the split view is active, **When** the user drags the
   divider between the two panes, **Then** the panes resize
   proportionally and content in both panes adjusts to the new width.
2. **Given** the split view is active, **When** the user drags the
   divider to an extreme position, **Then** neither pane collapses
   below a usable minimum width (the divider stops at a reasonable
   minimum).

---

### User Story 3 - Dismiss Data Preview (Priority: P3)

A developer who has finished previewing data wants to return to the
full-width schema tree view. They can close the data preview pane to
restore the single-pane layout.

**Why this priority**: Closing the preview pane is a convenience
feature. The split view is the default useful state, and dismissing it
is a secondary action.

**Independent Test**: Open a database, click a table to show the split
view, then close the data preview. Verify the schema tree returns to
full width.

**Acceptance Scenarios**:

1. **Given** the split view is active, **When** the user clicks a close
   button on the data preview pane, **Then** the data preview closes
   and the schema tree returns to full width.
2. **Given** the data preview has been closed, **When** the user clicks
   another table in the schema tree, **Then** the split view reopens
   with the new table's data.

---

### Edge Cases

- What happens when the database has a table with zero rows? The data
  preview pane shows an empty state message (e.g., "No data in this
  table") rather than a blank pane.
- What happens when the extension window is very narrow (e.g., side
  panel)? The minimum pane widths prevent the layout from becoming
  unusable; if the window is too narrow for two panes, the data preview
  takes full width with a back button to return to the tree.
- What happens when the user switches to the ER Diagram view while the
  split view is active? The split layout is specific to the schema tree
  view. Switching to the ER diagram replaces the full view. Returning
  to the schema tree restores the split state if a table was previously
  selected.
- What happens when the database is reloaded (file changed externally)
  while the split view is active? The schema tree refreshes and the
  data preview re-fetches the current table's data. If the previously
  selected table no longer exists, the preview pane closes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The view MUST split into two horizontal panes (schema tree
  left, data preview right) when a user clicks a table name in the
  schema tree.
- **FR-002**: The schema tree MUST remain fully interactive (expand,
  collapse, search, context menu) while the split view is active.
- **FR-003**: Clicking a different table in the schema tree MUST update
  the data preview pane to show the newly selected table's data without
  closing and reopening the split.
- **FR-004**: The currently previewed table MUST be visually highlighted
  in the schema tree.
- **FR-005**: The divider between panes MUST be draggable to resize the
  panes, with a minimum width for each pane to prevent unusable states.
- **FR-006**: The data preview pane MUST include a close button that
  dismisses the preview and restores the schema tree to full width.
- **FR-007**: The data preview in the split pane MUST retain all
  existing functionality: pagination, column sorting, and NULL value
  styling.
- **FR-008**: The "Preview" button on table rows in the schema tree
  MUST be replaced by direct click-to-preview behavior (clicking the
  table name itself activates the preview).
- **FR-009**: The ER Diagram view MUST continue to use the full view
  (not split pane). Switching between ER Diagram and schema tree views
  MUST preserve the selected table state.

## Assumptions

- This feature modifies the existing SQL Database Visualizer extension
  (feature 001). It is not a standalone feature.
- The split layout only applies to the schema tree + data preview
  combination. The ER Diagram continues to be a full-view mode.
- The default split ratio is approximately 40% schema tree / 60% data
  preview. This is a reasonable starting point and can be adjusted via
  the draggable divider.
- Right-click context menu on tables remains available for "Copy Table
  Name" but the "Preview Data" option is replaced by the click-to-
  preview behavior.
- The split view is not persisted across sessions. Opening a new
  database starts with the full-width schema tree.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can preview data for 5 different tables in under
  30 seconds without navigating away from the schema tree (compared to
  the current flow requiring back-and-forth navigation).
- **SC-002**: The split view layout renders and becomes interactive
  within 500 milliseconds of clicking a table name.
- **SC-003**: 95% of users discover data preview by clicking a table
  name without needing documentation or tooltips.
- **SC-004**: The resizable divider responds within 16 milliseconds of
  drag input (60fps) for a smooth experience.
- **SC-005**: Switching between tables in the schema tree updates the
  data preview in under 2 seconds (consistent with existing data
  preview performance).
