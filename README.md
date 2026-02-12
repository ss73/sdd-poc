# SQL Database Visualizer

A VS Code extension for visualizing SQLite database schemas, ER diagrams, and previewing table data — no configuration required.

## Features

- **Schema Tree** — Browse tables, columns (with types and constraints), and indexes in an expandable tree with real-time search/filter
- **ER Diagram** — Interactive entity-relationship diagram with foreign key edges, automatic layout (ELK.js), pan, and zoom
- **Split-View Data Preview** — Click any table to preview its data in a resizable side pane with pagination, sortable columns, and NULL highlighting
- **Inline Data Editing** — Double-click any cell to edit its value in place. Changes are written directly to the database file via SQLite's native journaling. Constraint violations (NOT NULL, UNIQUE, FK) surface as inline error messages. A dedicated "Set NULL" button distinguishes null from empty string.
- **Row Insert & Delete** — Select a row with a single click and delete it via an inline confirmation bar. Add new rows with the "Add Row" button — fill in values using inline inputs, with auto-increment PKs handled automatically. After insert, the grid navigates to and selects the new row. Foreign key and constraint errors are displayed inline.
- **Custom Query Tabs** — Write and execute arbitrary SQL from a dedicated query view. Results display in a paginated, sortable table consistent with the data preview. DML queries report affected row counts; errors are shown inline. Open multiple tabs with independent query text and results. Use Cmd+Enter (Ctrl+Enter on non-Mac) to execute. All tab state is transient — nothing to save or manage.
- **Zero Configuration** — Just open a `.db`, `.sqlite`, or `.sqlite3` file

## Installation

### From VSIX

```sh
code --install-extension sql-db-visualizer-0.1.0.vsix
```

### From Source

```sh
npm install
npm run build
npm run package   # creates .vsix
```

## Usage

1. Open any `.db`, `.sqlite`, or `.sqlite3` file in VS Code
2. The schema tree loads automatically — expand tables to see columns and indexes
3. Click a table name to preview its data in a split pane on the right
4. Double-click any editable cell to modify its value — press Enter to save, Escape to cancel
5. Click a row to select it, then use "Delete" to remove it (with confirmation) or "Add Row" to insert a new record
6. Use the search bar to filter tables and columns by name
7. Switch to the ER diagram view to see table relationships
8. Switch to the Query view to write and run custom SQL — open multiple tabs for parallel queries

The split pane divider is draggable. Close the preview pane with the X button to return to a full-width schema tree.

Primary key and BLOB columns are read-only. If the database file is read-only or has been modified externally, editing is disabled until you reload.

## Development

```sh
npm install
npm run build     # bundle extension + webview
npm run watch     # rebuild on changes
npm run lint      # eslint
npm run dev       # launch VS Code with extension loaded
```

A sample `test.db` is included for manual testing.

## Architecture

The extension uses a custom editor provider (`CustomEditorProvider`) that renders a React 18 webview. SQLite files are opened directly via [node-sqlite3-wasm](https://github.com/nicolo-ribaudo/node-sqlite3-wasm) (WASM-based SQLite with native file I/O), enabling both reads and incremental writes without full-file rewrites. ER diagrams are rendered with [@xyflow/react](https://github.com/xyflow/xyflow) and laid out with [elkjs](https://github.com/kieler/elkjs).

```
src/
├── extension.ts          # entry point, registers custom editor
├── schemaProvider.ts     # editor provider, file watching, messaging
├── sqliteService.ts      # SQLite queries and updates via node-sqlite3-wasm
├── types.ts              # shared interfaces
└── webview/
    ├── App.tsx           # main UI, view switching, split layout
    ├── SchemaTree.tsx    # tree with search/filter
    ├── DataPreview.tsx   # paginated data grid with inline editing
    ├── QueryView.tsx     # custom SQL query tabs
    ├── ErDiagram.tsx     # interactive ER diagram
    ├── TableNode.tsx     # ER diagram node component
    ├── index.tsx         # webview entry
    └── vscodeApi.ts      # VS Code API wrapper
```

## License

MIT
