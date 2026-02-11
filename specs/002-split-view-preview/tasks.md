# Tasks: Split View Data Preview

**Input**: Design documents from `/specs/002-split-view-preview/`
**Prerequisites**: plan.md (required), spec.md (required for user stories)

**Tests**: No tests requested. Manual testing via Extension Development Host.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: User Story 1 - Split Pane Layout (Priority: P1) MVP

**Goal**: Clicking a table in the schema tree splits the view into schema tree (left) and data preview (right). The schema tree remains fully interactive and the previewed table is highlighted.

**Independent Test**: Open a SQLite file, click any table name in the schema tree, verify the window splits into two panes. Click a different table, verify the right pane updates. Verify the schema tree stays visible and the selected table is highlighted. Switch to ER Diagram and back, verify split state is preserved.

### Implementation for User Story 1

- [x] T001 [US1] Refactor state model and layout from view-mode switching to split pane flexbox — schema tree always visible on left, data preview on right when a table is selected, ER diagram remains full-view in `src/webview/App.tsx`
- [x] T002 [P] [US1] Replace "Preview" hover button with click-to-preview on table name, add `selectedTable` prop with visual highlight styling, remove "Preview Data" from context menu in `src/webview/SchemaTree.tsx`
- [x] T003 [P] [US1] Remove back button, adjust toolbar for split pane context (table name + row count + close placeholder), show "No data in this table" empty state for zero-row tables in `src/webview/DataPreview.tsx`

**Checkpoint**: At this point, clicking a table shows a persistent split view. The schema tree stays visible and interactive. ER Diagram still works as full view.

---

## Phase 2: User Story 2 - Resizable Divider (Priority: P2)

**Goal**: The divider between the schema tree and data preview panes is draggable to resize them, with minimum width constraints.

**Independent Test**: Open a database, click a table to activate split view, drag the divider between panes. Verify both panes resize smoothly and neither collapses below a usable minimum.

### Implementation for User Story 2

- [x] T004 [US2] Add draggable divider element between panes with mousedown/mousemove/mouseup handlers, min-width constraints (200px per pane), cursor styling, and 60fps drag performance in `src/webview/App.tsx`

**Checkpoint**: The split pane divider can be dragged smoothly to resize both panes.

---

## Phase 3: User Story 3 - Dismiss Data Preview (Priority: P3)

**Goal**: Users can close the data preview pane to return to full-width schema tree, and reopen it by clicking another table.

**Independent Test**: Open a database, click a table to show split view, click the close button on the data preview. Verify the schema tree returns to full width. Click another table, verify the split view reopens.

### Implementation for User Story 3

- [x] T005 [US3] Add close button to data preview toolbar and wire `onClose` callback to clear `previewTable` state, restoring full-width schema tree in `src/webview/DataPreview.tsx` and `src/webview/App.tsx`

**Checkpoint**: Data preview can be dismissed and reopened by clicking another table.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases and refinements across all stories

- [x] T006 Handle edge cases — narrow window fallback (data preview takes full width with back button when too narrow), database reload with missing table (close preview if selected table no longer exists), ER diagram to schema tree state preservation in `src/webview/App.tsx`

---

## Dependencies & Execution Order

### Phase Dependencies

- **User Story 1 (Phase 1)**: No dependencies — can start immediately. This is the MVP.
- **User Story 2 (Phase 2)**: Depends on T001 (split layout must exist to add divider)
- **User Story 3 (Phase 3)**: Depends on T003 (DataPreview toolbar must be updated)
- **Polish (Phase 4)**: Depends on all user stories being complete

### Within User Story 1

- T001 (App.tsx layout) MUST complete first — T002 and T003 depend on the new split layout and props
- T002 (SchemaTree) and T003 (DataPreview) can run in parallel [P] — different files, no mutual dependency

### Parallel Opportunities

```
Phase 1 (US1):
  T001 (App.tsx layout)
    ├── T002 (SchemaTree.tsx) ──┐
    └── T003 (DataPreview.tsx) ─┤ [parallel]
                                │
Phase 2 (US2):                  │
  T004 (divider) ──────────────←┘
                                │
Phase 3 (US3):                  │
  T005 (close button) ────────←┘
                                │
Phase 4 (Polish):               │
  T006 (edge cases) ──────────←┘
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete T001: Refactor App.tsx to split layout
2. Complete T002 + T003 in parallel: SchemaTree + DataPreview updates
3. **STOP and VALIDATE**: Test split view in Extension Development Host
4. If working, proceed to User Story 2

### Incremental Delivery

1. User Story 1 (T001-T003) → Test split view → Core UX improvement delivered
2. User Story 2 (T004) → Test divider drag → Resizable panes
3. User Story 3 (T005) → Test close/reopen → Full dismiss flow
4. Polish (T006) → Edge case handling → Production-ready

---

## Notes

- All changes are pure webview (React + CSS). No extension host or SQLite service modifications.
- No new dependencies. CSS flexbox for layout, native mouse events for divider.
- 3 existing files modified, 0 new files created.
- Default split ratio: 40% schema tree / 60% data preview.
- [P] tasks = different files, no dependencies between them.
