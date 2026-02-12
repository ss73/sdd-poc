# SQL Database Visualizer

A VS Code extension for visualizing SQLite database schemas, ER diagrams, and previewing table data — no configuration required.

## Features

- **Schema Tree** — Browse tables, columns (with types and constraints), and indexes in an expandable tree with real-time search/filter
- **ER Diagram** — Interactive entity-relationship diagram with foreign key edges, automatic layout (ELK.js), pan, and zoom
- **Split-View Data Preview** — Click any table to preview its data in a resizable side pane with pagination, sortable columns, and NULL highlighting
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
4. Use the search bar to filter tables and columns by name
5. Switch to the ER diagram view to see table relationships

The split pane divider is draggable. Close the preview pane with the X button to return to a full-width schema tree.

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

The extension uses a custom readonly editor provider (`CustomReadonlyEditorProvider`) that renders a React 18 webview. SQLite files are parsed in-memory using [sql.js](https://github.com/sql-js/sql.js) (WebAssembly). ER diagrams are rendered with [@xyflow/react](https://github.com/xyflow/xyflow) and laid out with [elkjs](https://github.com/kieler/elkjs).

```
src/
├── extension.ts          # entry point, registers custom editor
├── schemaProvider.ts     # editor provider, file watching, messaging
├── sqliteService.ts      # SQLite queries via sql.js
├── types.ts              # shared interfaces
└── webview/
    ├── App.tsx           # main UI, view switching, split layout
    ├── SchemaTree.tsx    # tree with search/filter
    ├── DataPreview.tsx   # paginated data grid
    ├── ErDiagram.tsx     # interactive ER diagram
    ├── TableNode.tsx     # ER diagram node component
    ├── index.tsx         # webview entry
    └── vscodeApi.ts      # VS Code API wrapper
```

## License

MIT
