# Web Transform Assistant

A standalone static web app for building [json-transformer](https://github.com/kimmania/json-transformer) mappings visually. No server required — just open `index.html` in your browser.

## Features

### Core Functionality
- **Visual Mapping Editor** — Table-based field mapping UI with add/remove/reorder, type selection, format options, and default values
- **Source Data Tree Viewer** — Collapsible tree view with color-coded type badges (string, number, boolean, null, object, array)
- **Live Preview** — Real-time output updates as you modify your mapping
- **Guided Wizard Mode** — Step-by-step wizard for creating mappings without knowing the format upfront
- **Free-Form Code Editor** — Direct JSON or JS editing with syntax validation and formatting

### Data Loading
- **File Picker** — Load any JSON file via file picker
- **Sample Data** — 2 bundled sample datasets (Employees with nested objects, Orders with arrays) for immediate testing
- **Data Inspector** — Shows record count, field count, types, and statistics

### Export and Import
- **Export Mapping** — Download as `.json` or `.js` file compatible with the json-transformer CLI
- **Export Output** — Download transformed data as JSON
- **Import Mapping** — Load existing `.json` or `.js` mapping files
- **Copy to Clipboard** — Copy mapping or output text

### UI/UX
- **Dark/Light Theme** — Toggle between themes, preference saved to localStorage
- **Auto-Save** — Mapping drafts saved to localStorage automatically
- **Toast Notifications** — Non-blocking error/success/warning messages
- **3-Pane Layout** — Source tree | mapping editor | live preview

## Quick Start

1. Open `index.html` in your browser (or serve via any HTTP server)
2. Click "Load Data" to load a JSON file, or pick a sample dataset from the dropdown
3. Use the **Visual** editor to add field mappings, or switch to **JSON**/**JS** mode for direct editing
4. See live preview updates in the right panel as you work
5. Click "Wizard" for a guided step-by-step mapping experience
6. Export your mapping when ready

## Technical Details

- **Framework**: Preact 10.x (inlined, ~11KB minified)
- **Hooks**: Preact hooks (inlined, ~4KB)
- **Transform Engine**: Browser-compatible port of json-transformer's `transform.js` (~27KB)
- **Total Bundle**: ~106KB uncompressed (no build step, no npm dependencies)
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
