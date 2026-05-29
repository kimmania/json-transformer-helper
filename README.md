# Web Transform Assistant

A standalone static web app for building [json-transformer](https://github.com/kimmania/json-transformer) mappings visually. No server required — just open `index.html` in your browser.

## Features

### Core Functionality
- **Visual Mapping Editor** — Field map, template strings (`{Field}`), array (`forEach`), nested object, and compute mappings; coalesce fallback picker, value maps, format pickers, passthrough toggle, validation hints
- **Source tree** — Search with highlights, one-record vs all-records view, go-to-record navigation, sample values on fields
- **Compute Templates** — Pre-built expressions (concat, arithmetic, etc.) plus custom JS with sandboxed preview
- **Source Data Tree Viewer** — Collapsible tree with search, sample values, click-to-copy paths
- **Live Preview** — Debounced preview (first N records), expected-output diff, record navigation
- **Guided Wizard Mode** — Per-field defaults, accept-all-remaining, review + sample output before finish
- **Free-Form Code Editor** — JSON / JS modes with syntax validation and format
- **Undo / Redo** — Mapping history in visual mode
- **Collapsible Panels** — Collapse source, mapping, or preview columns

### Data Loading
- **File Picker** — Load any JSON file via file picker
- **Sample Data** — 2 bundled sample datasets (Employees with nested objects, Orders with arrays) for immediate testing
- **CLI Samples** — Dropdown loads official [json-transformer](https://github.com/kimmania/json-transformer) mapping + test data pairs from the `samples/` folder (requires a local HTTP server; see Quick Start)
- **Data Inspector** — Shows record count, field count, types, and statistics

### Export and Import
- **Export Mapping** — Download as `.json` or `.js` in the same shape the CLI expects (`id`, `version`, `passthrough`, `fields`, optional `schema` / `dictionaries`)
- **Export Output** — Download transformed data as JSON
- **Import Mapping** — Load existing `.json` or `.js` mapping files from the CLI repo (e.g. `mapping-nested.json`, `mapping-employee.js`). Simple mappings open in the visual editor; advanced features (conditions, templates, `groupBy`, etc.) stay in JSON/JS mode for full fidelity
- **Copy to Clipboard** — Copy mapping or output text

### UI/UX
- **Dark/Light Theme** — Toggle between themes, preference saved to localStorage
- **Auto-Save (opt-in)** — Optional mapping drafts saved to localStorage; off by default until you enable it
- **Toast Notifications** — Non-blocking error/success/warning messages
- **3-Pane Layout** — Source tree | mapping editor | live preview

## Quick Start

1. Open `index.html` in your browser, or run `python3 -m http.server 8888` and visit http://localhost:8888 (needed for **CLI Samples** and optional auto-load of `samples/`)
2. Click "Load Data" to load a JSON file, use **Sample Data...**, or choose **CLI Samples...** to load a mapping + test JSON together
3. Use **Import** on the mapping panel to load a `.json` / `.js` file from disk (works on `file://` without a server)
4. Use the **Visual** editor to add field mappings, or switch to **JSON**/**JS** mode for direct editing
5. See live preview updates in the right panel as you work
6. Click "Wizard" for a guided step-by-step mapping experience
7. **Export** your mapping when ready — use it with `node cli.js transform -d data.json -m mapping.js`

The `samples/` directory contains copies of mapping and test files from the json-transformer project. Re-copy from `../json-transformer` when upstream samples change.

## Technical Details

- **Framework**: Preact 10.x (inlined, ~11KB minified)
- **Hooks**: Preact hooks (inlined, ~4KB)
- **Transform Engine**: Browser-compatible port of json-transformer's `transform.js` (~27KB)
- **Mapping Features**: `mapping-features.js` — build/parse, compute templates, validation (~8KB)
- **Total Bundle**: ~120KB+ uncompressed (no build step, no npm dependencies)
- **Browser Support**: Modern browsers (Chrome, Firefox, Safari, Edge)
- **Offline**: Works fully offline — all assets bundled, zero network requests

## Compatibility

Generated mappings are 100% compatible with the [json-transformer CLI](https://github.com/kimmania/json-transformer). Use them directly with:

```bash
node cli.js transform -d your-data.json -m your-mapping.js
```

## Requirements

See `transform-assistant-requirements.md` for the full feature specification.

## Development

No build step required. Open `index.html` directly or serve via any HTTP server:

```bash
python3 -m http.server 8888
```

Then visit http://localhost:8888
