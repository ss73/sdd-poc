# Quickstart: Export to CSV for Result Sets (006)

## Prerequisites

- VS Code with the SQL DB Visualizer extension installed (or running in Extension Development Host via `F5`)
- A `.db` SQLite file open in the editor
- Feature branch: `006-export-csv`

---

## Manual Smoke Test Plan

Run these scenarios in order. Each requires the extension to be running.

---

### Scenario 1 — Export Query Tab Results (P1 happy path)

1. Open any `.db` file
2. Click **Query** in the toolbar to open the query view
3. Type: `SELECT * FROM <any_table> LIMIT 5`
4. Press **Execute** (or ⌘Enter)
5. Click **Export to CSV** button (should appear above the result table)
6. In the save dialog, choose a destination and confirm
7. Open the saved `.csv` file in a text editor

**Expected**:
- First line: column headers separated by commas
- Lines 2–6: five data rows
- Line endings are CRLF (`\r\n`)
- File is valid UTF-8

---

### Scenario 2 — Export disabled when no result

1. Open the query view
2. Verify a new empty tab is shown
3. Check the **Export to CSV** button

**Expected**: Button is disabled (greyed out) — no result set yet

---

### Scenario 3 — Export Table Preview (full table)

1. Click a table in the schema tree to open the data preview
2. Click **Export to CSV** button in the data preview toolbar
3. Save the file
4. Open in a spreadsheet application (Excel, LibreOffice Calc, or Numbers)

**Expected**:
- All rows from the table are present (check: row count notification matches row count in spreadsheet)
- Column headers correct
- Spreadsheet parses without errors

---

### Scenario 4 — Cancel save dialog

1. Execute any query
2. Click **Export to CSV**
3. When the save dialog appears, press **Cancel** (or Escape)

**Expected**: No file is written; Export button re-enables; no error shown

---

### Scenario 5 — Empty table export

1. Open a table with no rows (or create one via: `CREATE TABLE empty_test (id INTEGER)`)
2. Click **Export to CSV**
3. Save and open the file

**Expected**: CSV contains only the header row; notification says "Exported 0 rows"

---

### Scenario 6 — Special characters in values

1. Insert a row containing: a value with a comma, a value with a `"` (double-quote), and a value with a newline
   ```sql
   INSERT INTO test_table (name, note) VALUES ('Smith, John', 'He said "hello"');
   ```
2. Export the table
3. Open in a spreadsheet application

**Expected**:
- `Smith, John` → cell contains `Smith, John` (no splitting on comma)
- `He said "hello"` → cell contains `He said "hello"` (quote intact)
- No data spillover between columns

---

### Scenario 7 — NULL and BLOB values

1. Query a table that has NULL values (or insert one: `INSERT INTO t (col) VALUES (NULL)`)
2. Export

**Expected**:
- NULL cells → empty in the CSV (nothing between the commas)
- BLOB cells → literal text `(BLOB)` in the CSV

---

### Scenario 8 — Cancellation during export (large table)

1. Open a large table (100k+ rows if available; otherwise import a large CSV first)
2. Click **Export to CSV** and choose a save path
3. When the progress notification appears, click **Cancel**

**Expected**:
- Export stops
- No partial file exists at the chosen path
- Export button re-enables
- No error notification (cancellation is not an error)

---

## Checklist

- [ ] Scenario 1 passes
- [ ] Scenario 2 passes
- [ ] Scenario 3 passes
- [ ] Scenario 4 passes
- [ ] Scenario 5 passes
- [ ] Scenario 6 passes
- [ ] Scenario 7 passes
- [ ] Scenario 8 passes (if large table available)
