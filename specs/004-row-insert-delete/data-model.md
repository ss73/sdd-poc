# Data Model: Row Insert and Delete

**Feature**: 004-row-insert-delete
**Date**: 2026-02-12

## Entities

### RowSelection (transient, webview state)

Represents the currently selected row in the data grid. Only one row can be selected at a time.

| Field          | Type                    | Description                                    |
|----------------|-------------------------|------------------------------------------------|
| rowIndex       | number                  | Row position within the current page (0-based) |
| rowIdentifier  | Record<string, unknown> | PK or rowid key-value pairs for the selected row |

**Lifecycle**: Created on row click → cleared on page change, sort change, or deselection.

### NewRow (transient, webview state)

Represents a row being composed but not yet persisted to the database.

| Field          | Type                    | Description                                    |
|----------------|-------------------------|------------------------------------------------|
| values         | Record<string, string>  | Column name → user-entered value (strings only before commit) |
| errors         | Record<string, string>  | Column name → validation error message         |
| isSaving       | boolean                 | Whether an insert request is in progress       |
| globalError    | string \| null          | Row-level error from failed insert             |

**Lifecycle**: Created when user clicks "Add Row" → populated as user fills cells → destroyed on successful commit or cancel.

### DeleteConfirmation (transient, webview state)

Represents a pending delete operation awaiting user confirmation.

| Field          | Type                    | Description                                    |
|----------------|-------------------------|------------------------------------------------|
| rowIndex       | number                  | Row being deleted (for visual highlight)       |
| rowIdentifier  | Record<string, unknown> | PK or rowid values for the DELETE WHERE clause |
| isDeleting     | boolean                 | Whether a delete request is in progress        |
| error          | string \| null          | Error from failed delete attempt               |

**Lifecycle**: Created when user triggers delete on selected row → destroyed on confirm (success), confirm (error displayed), or cancel.

## Relationships

```
RowSelection --triggers--> DeleteConfirmation (when delete action invoked)
DeleteConfirmation --sends--> DeleteRowMessage (on confirm)
NewRow --sends--> InsertRowMessage (on commit)
InsertRowMessage/DeleteRowMessage --response--> RowOperationResult (success or error)
RowOperationResult --refreshes--> DataPage (current page re-fetched)
```

## State Transitions

### Row Selection
```
None → Selected (click on row)
Selected → None (click elsewhere, page change, sort change)
Selected → DeleteConfirming (delete action triggered)
```

### Delete Flow
```
DeleteConfirming → Deleting (user confirms)
DeleteConfirming → Selected (user cancels)
Deleting → None (delete succeeded, row gone, grid refreshed)
Deleting → DeleteConfirming (delete failed, error displayed)
```

### Insert Flow
```
None → Composing (user clicks "Add Row")
Composing → Saving (user commits row)
Composing → None (user cancels — confirm if values entered)
Saving → None (insert succeeded, grid refreshed)
Saving → Composing (insert failed, error displayed)
```
