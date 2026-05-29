# Web Transform Assistant

A standalone static web app for building [json-transformer](https://github.com/kimmania/json-transformer) mappings visually. No build step and no npm install — open `index.html` in a browser or serve the folder over HTTP.

## What it does

Load JSON source data, define a mapping in **Visual**, **JSON**, or **JS** mode, and see transformed output update in a live preview. Export mappings in the same shape the CLI expects (`id`, `version`, `passthrough`, `fields`, and optional `schema` / `dictionaries`).

```bash
node cli.js transform -d your-data.json -m your-mapping.js
```

## Quick start

1. Open `index.html`, or run a local server (required for **CLI Samples**):

   ```bash
   python3 -m http.server 8888
   ```

   Then open http://localhost:8888

2. **Load source data** — file picker, **Sample Data…**, or **CLI Samples…** (mapping + test JSON together).

3. **Build a mapping** — Visual editor, **Wizard**, or edit **JSON** / **JS** directly.

4. **Export** — download `.json` or `.js`, copy mapping text, or export preview output.

**Note:** File picker import for data and mappings works on `file://`. The **CLI Samples** dropdown uses `fetch()` and needs HTTP.

## Features

### Visual mapping editor

| Capability | Visual mode |
|------------|-------------|
| Field map (`from` → target) | Yes |
| Template string (`{Salary} {Status}`) | Yes — set **Source** to **Template string** |
| Value map (`map` lookup table) | Yes — row editor + “from sample data” |
| Coalesce (fallback paths) | Yes — path picker |
| Date / number formats | Yes — presets on field rows |
| `forEach` arrays + nested fields | Yes |
| Nested objects | Yes |
| Compute (expression string) | Yes — templates + custom `return …` |
| Passthrough | Yes — global toggle |
| Conditions (`if` / `and` / `or`) | View only — edit in JSON/JS |
| `groupBy`, `flatten`, aggregates, etc. | View only — edit in JSON/JS |
| Compute as arrow functions | JS mode only |

- **Validation** — missing targets, unknown source paths, empty nested mappings.
- **Undo / redo** — in visual mode.

### Source data panel

- Collapsible tree with type badges and inline previews.
- **Search** — filter tree; matching keys/values highlighted.
- **One record** / **All records** — browse a single row (mapping-friendly paths) or every record at the top level.
- **Go to record** — prev/next and numeric jump (array datasets).
- **Selection detail** — breadcrumb, copy dot-path, copy JSON fragment.
- **Inspector** — record count, field stats, sample values.

### Mapping modes

- **Visual** — table-style field rows (best for simple and nested mappings).
- **JSON** — declarative mapping; string `compute` expressions.
- **JS** — `export default { … }`; function-valued `compute` when needed.

Import picks the starting mode: simple mappings → Visual; rules with function compute or heavy advanced features → JS/JSON. Advanced rows imported from JS stay visible as read-only cards in Visual while simple rows remain editable.

### Live preview

- Debounced transform on mapping changes.
- First *N* records (configurable), with record prev/next.
- Optional **expected output** file for side-by-side diff.
- Inline errors on failed rows; click to jump records.
- Schema validation when the mapping defines `schema`.

### Code editor (JSON / JS)

- Syntax highlighting and **Format** button.
- Parse errors with line indication; light semantic warnings (e.g. unknown source paths).
- **Copy mapping** to clipboard.

### Wizard

Linear flow: passthrough → per-field decisions (skip / accept default / customize) → `forEach` and nested sub-steps → review with sample output → finish into Visual mode.

### Export and import

- **Export mapping** — `.json` or `.js` (`.js` when function compute is present).
- **Export output** — transformed JSON download.
- **Import mapping** — `.json` / `.js` from disk or CLI samples.
- **Copy** — mapping or output text.

### UI

- **3-pane layout** — source | mapping | preview; each column collapsible.
- **Resizable** — drag handles for source and preview column width (saved in `localStorage`).
- **Help** — in-app topics (formats, compute, conditions, JSON vs JS, etc.).
- **Theme** — light / dark, persisted.
- **Auto-save** — opt-in draft to `localStorage` (off by default).
- **Toasts** — success / warning / error feedback.

## Bundled and CLI samples

### In-app sample data

- Employees (nested objects)
- Employee conditions (CLI demo field names)
- Orders (arrays)

### CLI Samples dropdown

Official-style pairs from `samples/` (copied from [json-transformer](https://github.com/kimmania/json-transformer)):

| Sample | Mapping | Data |
|--------|---------|------|
| Nested order (JSON) | `mapping-nested.json` | `test-nested.json` |
| Nested order + compute (JS) | `mapping-nested.js` | `test-nested.json` |
| CRM legacy → modern (JSON) | `mapping-crm-example.json` | `test-data.json` |
| CRM example (JS) | `mapping-crm-example.js` | `test-data.json` |
| Employee conditions (JS) | `mapping-employee.js` | `test-employees.json` |
| Data cleaning (JS) | `mapping-data-cleaning.js` | `test-data-cleaning.json` |
| Data shaping (JS) | `mapping-shaping.js` | `test-shaping.json` |
| Schema validated (JS) | `mapping-validated.js` | `test-data.json` |
| Timesheet (JS) | `mapping-timesheet.js` | `test-data.json` |

Re-copy from `../json-transformer` when upstream samples change.

## Project layout

| File | Role |
|------|------|
| `index.html` | Entry point; loads scripts in order |
| `app.js` | Preact UI (tree, editor, wizard, preview, help) |
| `transform-browser.js` | Browser port of transform + `inspect()` |
| `mapping-features.js` | Visual ↔ mapping object, validation, export |
| `sample-mappings.js` | CLI sample catalog + loader |
| `styles.css` | Layout and components |
| `preact.js`, `preact-hooks.js` | Inlined Preact 10.x |
| `samples/` | Mapping + test JSON/JS from CLI repo |
| `transform-assistant-requirements.md` | Full requirements spec |

## Technical notes

- **Stack:** Preact 10.x + hooks (inlined), no bundler.
- **Transform engine:** `transform-browser.js` — same semantics as CLI `transform.js`, including sandboxed string `compute` (500ms timeout).
- **Offline:** All assets local; no CDN.
- **Browsers:** Current Chrome, Firefox, Safari, Edge (desktop-first).
- **Size:** ~120KB+ uncompressed JS/CSS total; no npm dependencies.

## Requirements

See `transform-assistant-requirements.md` for the full feature list, priorities, and v2 deferrals (JSON Schema UI, CSV, etc.).

## Development

No build step. Edit files and refresh the browser.

```bash
python3 -m http.server 8888
```

Use HTTP when testing **CLI Samples**, `fetch`-based sample loads, or CORS-sensitive file paths.
