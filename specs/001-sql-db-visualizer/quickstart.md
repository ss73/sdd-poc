# Quickstart: SQL Database Visualizer

**Branch**: `001-sql-db-visualizer` | **Date**: 2026-02-11

## Prerequisites

- Node.js 18+ and npm
- VS Code 1.85+ (for CustomReadonlyEditorProvider support)
- Git

## Setup

```bash
# Clone and enter the project
git clone <repo-url>
cd sdd-poc
git checkout 001-sql-db-visualizer

# Install dependencies
npm install

# Build the extension (both extension host and webview bundles)
npm run build
```

## Development

```bash
# Watch mode: rebuilds on file changes
npm run watch

# Launch VS Code Extension Development Host
# Press F5 in VS Code, or:
npm run dev
```

The Extension Development Host opens a new VS Code window with the
extension loaded. Place a `.db`, `.sqlite`, or `.sqlite3` file in the
workspace and click it to test.

## Project Commands

| Command          | Description                                        |
|------------------|----------------------------------------------------|
| `npm run build`  | Build extension host + webview bundles (production) |
| `npm run watch`  | Watch mode for development                         |
| `npm run dev`    | Launch Extension Development Host                  |
| `npm run test`   | Run all tests (unit + integration)                 |
| `npm run test:unit` | Run unit tests only (Vitest)                    |
| `npm run test:integration` | Run VS Code integration tests          |
| `npm run lint`   | Run ESLint                                         |
| `npm run package`| Build .vsix for distribution                       |

## Architecture Overview

```
┌─────────────────────────────┐
│    VS Code Extension Host   │
│    (Node.js process)        │
│                             │
│  extension.ts               │
│    ├── schemaProvider.ts    │  ← CustomReadonlyEditorProvider
│    └── sqliteService.ts     │  ← sql.js (Wasm) database access
│                             │
│         postMessage ↕       │
│                             │
│  ┌───────────────────────┐  │
│  │    Webview (iframe)   │  │
│  │    React application  │  │
│  │                       │  │
│  │  SchemaTree.tsx       │  │  ← Tree view of tables/columns
│  │  ErDiagram.tsx        │  │  ← ReactFlow + ELK.js
│  │  DataPreview.tsx      │  │  ← HTML table with pagination
│  └───────────────────────┘  │
└─────────────────────────────┘
```

## Build System

Two esbuild entry points:

1. **Extension host** (`src/extension.ts`): Bundled as CommonJS for
   Node.js. Outputs to `dist/extension.js`. Includes sql.js Wasm
   binary copied to `dist/`.

2. **Webview** (`src/webview/index.tsx`): Bundled as ESM for the
   browser. Outputs to `dist/webview/`. Includes React, ReactFlow,
   and ELK.js.

## Test Database

For development, create a test SQLite database:

```bash
sqlite3 test.db <<'EOF'
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE
);
CREATE TABLE posts (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT,
  user_id INTEGER REFERENCES users(id)
);
CREATE TABLE comments (
  id INTEGER PRIMARY KEY,
  body TEXT NOT NULL,
  post_id INTEGER REFERENCES posts(id),
  user_id INTEGER REFERENCES users(id)
);
CREATE INDEX idx_posts_user ON posts(user_id);
CREATE INDEX idx_comments_post ON comments(post_id);
INSERT INTO users VALUES (1, 'Alice', 'alice@example.com');
INSERT INTO users VALUES (2, 'Bob', 'bob@example.com');
INSERT INTO posts VALUES (1, 'Hello World', 'First post', 1);
INSERT INTO comments VALUES (1, 'Great post!', 1, 2);
EOF
```

This gives you 3 tables with foreign keys, indexes, and sample data
for testing all three user stories.

## Validation Checklist

After setup, verify:

- [ ] `npm run build` completes without errors
- [ ] `dist/extension.js` exists
- [ ] `dist/webview/index.js` exists
- [ ] `dist/sql-wasm.wasm` exists
- [ ] F5 launches Extension Development Host
- [ ] Clicking `test.db` opens the schema visualizer
- [ ] Schema tree shows users, posts, comments tables
- [ ] "Show ER Diagram" renders 3 tables with FK lines
- [ ] "Preview Data" on users table shows 2 rows
