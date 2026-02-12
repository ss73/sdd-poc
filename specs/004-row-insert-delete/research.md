# Research: Row Insert and Delete

**Feature**: 004-row-insert-delete
**Date**: 2026-02-12

## R1: Delete SQL Strategy

**Decision**: Use parameterized `DELETE FROM "table" WHERE pk = ?` with the same row identification strategy as inline cell editing (PK columns, rowid fallback).

**Rationale**: The `updateCell()` method in sqliteService already builds parameterized WHERE clauses from `rowIdentifier` objects. Deletion uses the exact same pattern — only the SQL verb changes. Reusing the same `escapeId()` helper and `rowIdentifier` structure avoids duplication and ensures consistency.

**Alternatives considered**:
- Deleting by row position/offset — rejected because position is fragile (changes with sort/filter/pagination).

## R2: Insert SQL Strategy

**Decision**: Use parameterized `INSERT INTO "table" ("col1", "col2") VALUES (?, ?)` with only the columns the user explicitly provides. Omitted columns receive their database defaults (including auto-increment PKs).

**Rationale**: SQLite handles default values and auto-increment natively when columns are omitted from the INSERT statement. By only including columns where the user provided a value, we get correct behavior for DEFAULT, AUTOINCREMENT, and generated columns without special-casing any of them. The parameterized approach is consistent with `updateCell()`.

**Alternatives considered**:
- Inserting with all columns and explicit DEFAULT keyword — rejected because it requires knowing the default expressions and adds complexity with no benefit.
- Inserting a fully empty row first, then editing cells individually — rejected because it would fail on NOT NULL columns and create a partially valid row state.

## R3: Insert UX — New Row Composition

**Decision**: When the user clicks "Add Row", append a transient (not-yet-persisted) row to the bottom of the grid. The user fills in values using the existing inline cell edit inputs, then clicks a "Save" button (or presses Enter on the last cell) to commit the entire row. A "Cancel" button discards the transient row.

**Rationale**: This reuses the existing CellEdit input components from feature 003 without adding new form UI. The transient row is purely a webview state concern — it only becomes a database operation when the user explicitly commits. This matches the "immediate commit" pattern from cell editing but at the row level.

**Alternatives considered**:
- A modal form/dialog for new rows — rejected per constitution principle II (follow VS Code UX conventions, don't invent novel patterns) and principle I (YAGNI — the inline approach reuses existing components).
- Inserting an empty row immediately to the database, then editing — rejected because it creates invalid intermediate state (NOT NULL violations) and requires cleanup on cancel.

## R4: Delete Confirmation UX

**Decision**: Use an inline confirmation bar that appears above the data grid when the user triggers delete. The bar shows "Delete row?" with Confirm and Cancel buttons. No modal dialog.

**Rationale**: An inline confirmation is fast (no modal focus trap), non-disruptive (user can see which row is selected), and consistent with the extension's existing inline patterns (inline edit, inline errors). VS Code extensions rarely use modal dialogs for single-item operations.

**Alternatives considered**:
- `vscode.window.showWarningMessage()` — rejected because it creates a modal interruption and is typically used for extension-level warnings, not data grid operations inside a webview.
- No confirmation (immediate delete) — rejected because deletion is destructive and irreversible per SC-005.

## R5: Pagination After Insert/Delete

**Decision**: After a successful delete, re-fetch the current page. If the current page is now empty (last row on last page was deleted), navigate to the previous page. After a successful insert, re-fetch the current page — the new row will appear according to the current sort order (not necessarily at the bottom).

**Rationale**: Re-fetching is the simplest correct approach — it ensures the grid reflects the true database state including any side effects (triggers, default values, auto-increment assignments). The "navigate to previous page" edge case prevents showing an empty page after the last row is deleted.

**Alternatives considered**:
- Optimistic UI update (remove row from local state without re-fetching) — rejected for the same reason as in feature 003: it skips database-level validation and could show stale data.

## R6: New Row State Management

**Decision**: Track the transient new row as a separate `NewRow` state in DataPreview, distinct from the `CellEdit` state. The `NewRow` holds a `Record<string, string>` of column values being composed. When committed, these values are sent as an `insert-row` message. When cancelled, the state is simply cleared.

**Rationale**: Separating `NewRow` from `CellEdit` avoids conflating two different lifecycles — cell editing operates on existing data with an existing row identifier, while row insertion operates on data that doesn't exist yet and has no identifier until committed. Mixing them would add conditional logic throughout the edit flow.

**Alternatives considered**:
- Extending `CellEdit` with an `isNewRow` flag — rejected because it would require every edit handler to check this flag and branch accordingly.
