# Requirements: json-transformer Web Transform Assistant

> **Status:** Draft v0.1 — May 2026
> **Author:** Hermes Agent + User collaboration
> **Target:** Standalone static web app (no server required)
> **Branch:** `transform-assistant`

---

## 1. Problem Statement

The existing `mapping-builder.js` CLI wizard guides users through creating json-transformer mapping definitions interactively via `readline`. It works well for terminal users but has limitations:

- **No visual feedback** — users can't see source/target data side-by-side
- **No live preview** — must write mapping then run `cli.js transform` separately
- **No tree navigation** — XPath-like navigation is text-based
- **No schema visualization** — schema validation rules are invisible until runtime
- **Not accessible to non-terminal users** — requires a TTY

A standalone static web app would bring XSLT-editor-class features to json-transformer: dual-pane tree views, visual mapping, live preview, and a guided wizard — all in the browser with zero server dependency.

---

## 2. Goals

### 2.1 Primary Goals
1. **Visual mapping construction** — users build transforms by interacting with source/target data trees
2. **Live output preview** — every change to the mapping updates the output in real time
3. **Guided wizard mode** — step-by-step UX for users who prefer being led through the process
4. **Free-form editing mode** — power users can edit the mapping JSON or JS directly
5. **Compute function support** — generate `.js` mappings with custom compute functions for arbitrary transformations
6. **Zero-server deployment** — runs as a static HTML file opened locally or hosted anywhere

### 2.2 Secondary Goals
6. **Schema-awareness** — import JSON Schema and enforce type/cardinality constraints
7. **Mapping export/import** — save mappings as `.json` or `.js` files; reload them later
8. **Multiple test inputs** — load several source documents and preview against each
9. **Diff viewer** — compare expected output vs. actual output
10. **Cross-browser compatibility** — works in Chrome, Firefox, Safari, Edge

---

## 3. Non-Goals (v1)
- Streaming/large-file support — the web app loads data into memory
- Multi-user collaboration — single-user tool
- i18n/l10n — English-only for v1
- Mobile-responsive design — desktop-first

---

## 4. Feature Requirements

### 4.1 Data Loading & Inspection

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-001 | Load source JSON data via file picker | Must | `.json` files only (v1) |
| FR-002 | Load source CSV data via file picker | Should | Parse to JSON internally |
| FR-003 | Load target/expected output for comparison | Could | Optional reference |
| FR-004 | Load JSON Schema for source data | Could | `.json` schema files |
| FR-005 | Auto-inspect loaded data (type detection, null rates, distinct values) | Must | Reuse `inspect()` logic from CLI |
| FR-006 | Display inspection results in a summary panel | Must | Field names, types, sample values, stats |
| FR-007 | Support loading multiple source files (merge datasets) | Could | Match CLI `--data` repeat behavior |
| FR-008 | Sample data browser — navigate to any record/field | Must | Click-to-navigate tree |

**Translation from XSLT tools:** XSLT editors bind to source XML + XSD and show a tree view with type annotations. FR-005/FR-006/FR-008 replicate this for JSON.

---

### 4.2 Source Data Tree Viewer

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-100 | Render source data as a collapsible tree | Must | Array items shown as `[0]`, `[1]`, etc. |
| FR-101 | Show field types inline (string, number, boolean, object, array, null) | Must | Color-coded badges |
| FR-102 | Click a node to copy its dot-path (e.g., `user.address.city`) | Must | Clipboard API |
| FR-103 | Search/filter the tree by field name | Should | Type-to-filter |
| FR-104 | Highlight nodes matching a search term | Should | |
| FR-105 | Show sample values for each field | Must | First 3 non-null values |
| FR-106 | Navigate to a specific record by index | Should | "Go to record N" input |
| FR-107 | Toggle between "first record" view and "all records" aggregate view | Should | |

**Translation from XSLT tools:** XSLT editors show the source XML tree with XPath hints. FR-100–FR-107 do the same for JSON with dot-paths.

---

### 4.3 Target Schema Definition

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-200 | Define output fields via a field editor | Must | Add/remove/rename fields |
| FR-201 | Specify output field types (string, number, boolean, date, object, array) | Must | |
| FR-202 | Define nested output objects (recursive field editor) | Must | |
| FR-203 | Import target schema from JSON Schema | Could | Auto-populate field definitions |
| FR-204 | Load expected output and infer target schema | Could | Reverse-engineer from sample |
| FR-205 | Mark fields as required/optional | Should | Matches `schema.required` in mapping |
| FR-206 | Set default values for fields | Should | Matches `default` in mapping |

**Translation from XSLT tools:** XSLT editors let you define the target XML structure. FR-200–FR-206 do this for JSON output.

---

### 4.4 Visual Mapping (Core Feature)

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-300 | Map source field → target field by clicking source then target | Must | Click-to-link or drag-and-drop |
| FR-301 | Show active mappings as visual connections (lines, highlights, or a mapping table) | Must | |
| FR-302 | Edit mapping properties per field (format, map, coalesce, conditions) | Must | Side panel or inline editor |
| FR-303 | Support passthrough toggle (include unmapped source fields) | Must | Global setting |
| FR-304 | Support `forEach` array iteration mapping | Must | Visual sub-mapping for array items |
| FR-305 | Support nested object mapping | Must | Recursive field editor |
| FR-306 | Support value mapping (lookup tables / `map` feature) | Should | Key→value pairs UI |
| FR-307 | Support date formatting | Should | Date format picker |
| FR-308 | Support number formatting | Should | Decimal places, currency, etc. |
| FR-309 | Support coalesce (fallback fields) | Should | Add fallback field picker |
| FR-310 | Support conditions (include/exclude field based on source values) | Could | Rule builder UI |
| FR-311 | Support aggregation (sum, avg, min, max, count, distinct) | Could | Aggregation function picker |
| FR-312 | Support template strings (interpolation) | Could | Template builder with field insertions |
| FR-313 | Support dictionary/file lookups | Could | Upload reference data |
| FR-314 | Undo/redo for mapping changes | Should | Command stack |
| FR-315 | Mapping validation — flag unmapped required fields, invalid paths | Must | Real-time error indicators |
| FR-316 | Support compute functions (arithmetic, string manipulation, custom logic) | Must | Function builder UI |
| FR-317 | Compute function templates (concatenate fields, arithmetic operations, date math) | Must | Pre-built templates |
| FR-318 | Custom compute function editor (free-form JS expression) | Should | For advanced users |
| FR-319 | Compute function parameter hints (available fields, types) | Should | IntelliSense for function params |
| FR-320 | Compute function validation (syntax check, type safety warnings) | Should | Prevent runtime errors |

**Translation from XSLT tools:** This is the core "visual mapping" feature found in oXygen, XMLSpy, and Stylus Studio. Users draw connections between source and target nodes; the tool generates the transform definition.

---

### 4.5 Guided Wizard Mode

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-400 | Step-by-step wizard: load data → inspect → map fields → preview → export | Must | Linear flow with back/next |
| FR-401 | Present source fields one at a time for mapping decisions | Must | Reuse CLI wizard logic |
| FR-402 | Smart defaults pre-filled (type detection, snake_case→camelCase, format suggestions) | Must | Reuse `inferFieldDefaults()` |
| FR-403 | Skip field, accept default, or customize per field | Must | `[skip] [accept] [edit]` actions |
| FR-404 | Accept-all-remaining shortcut | Should | "Apply default to all remaining" |
| FR-405 | Sub-wizard for array `forEach` mapping | Must | Recursive field prompts |
| FR-406 | Sub-wizard for nested object mapping | Must | |
| FR-407 | Passthrough prompt at start | Must | "Include unmapped fields? [y/N]" |
| FR-408 | Preview screen before export | Must | Show generated mapping + sample output |
| FR-409 | Edit mapping after wizard (switch to free-form mode) | Must | Seamless mode transition |
| FR-410 | Wizard progress indicator | Should | Step N of M |

**Translation from XSLT tools:** Many XSLT tools offer a "mapping wizard" mode alongside free-form editing. FR-400–FR-410 replicate the CLI wizard experience in a visual context.

---

### 4.6 Live Preview & Testing

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-500 | Real-time output preview as mapping changes | Must | Updates on every keystroke/mapping change |
| FR-501 | Show output for first N records (configurable, default 5) | Must | |
| FR-502 | Navigate output records (prev/next or record picker) | Should | |
| FR-503 | Load expected output and show diff vs. actual | Should | Side-by-side diff viewer |
| FR-504 | Run transform against multiple loaded source files | Could | Tabbed output per file |
| FR-505 | Performance timing (ms per record) | Could | |
| FR-506 | Validation errors shown inline (highlight failing fields) | Must | Red markers on problematic output |
| FR-507 | Clear/reset preview | Should | |

**Translation from XSLT tools:** XSLT editors like oXygen offer "Run Transformation" with live output. FR-500–FR-507 do this with real-time updates.

---

### 4.7 Mapping Editor (Free-Form Mode)

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-600 | JSON editor for direct mapping editing | Must | Syntax-highlighted textarea or JSON editor |
| FR-601 | JS editor for mappings with compute functions | Must | Syntax-highlighted code editor |
| FR-602 | Syntax validation with error highlighting | Must | Real-time JSON/JS parse errors |
| FR-603 | Semantic validation (undefined fields, invalid options) | Should | |
| FR-604 | Switch between visual mapping and JSON/JS editor | Must | Three views: visual, JSON, JS |
| FR-605 | Auto-format/prettify JSON/JS | Should | |
| FR-606 | IntelliSense/autocomplete for field names and options | Could | Dropdown suggestions |
| FR-607 | Compute function inline editing with live preview | Must | Edit function body, see immediate results |

**Translation from XSLT tools:** XSLT editors provide both visual and code views. FR-600–FR-605 allow power users to edit the mapping JSON directly.

---

### 4.8 Export & Import

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-700 | Export mapping as `.json` file | Must | Download via browser |
| FR-701 | Export mapping as `.js` file (with `export default`) | Must | |
| FR-702 | Copy mapping to clipboard | Must | |
| FR-703 | Import existing mapping file | Must | File picker |
| FR-704 | Save mapping to localStorage (auto-save draft) | Should | Persist across page reloads |
| FR-705 | Export sample output | Should | Download transformed data |
| FR-706 | Export as shareable URL (mapping encoded in hash) | Could | Base64 in URL fragment |

**Translation from XSLT tools:** XSLT editors export transforms as `.xsl` files. FR-700–FR-706 do this for json-transformer mappings.

---

### 4.9 Schema Integration

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-800 | Load JSON Schema for source data | Could | `.json` schema file |
| FR-801 | Annotate tree nodes with schema type info | Could | |
| FR-802 | Enforce schema constraints during mapping | Could | Flag type mismatches |
| FR-803 | Auto-generate mapping from source + target schemas | Could | Schema-to-schema mapping |

**Translation from XSLT tools:** XSLT editors bind to XSD and enforce type/cardinality. FR-800–FR-803 do this for JSON Schema.

---

### 4.10 UI/UX Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-900 | Responsive layout (source tree | mapping editor | preview) | Must | 3-pane layout |
| FR-901 | Collapsible panels | Must | User can resize/hide panels |
| FR-902 | Dark mode / light mode toggle | Should | |
| FR-903 | Keyboard shortcuts (common actions) | Could | |
| FR-904 | Tooltips explaining mapping options | Should | |
| FR-905 | Help/documentation panel | Should | Inline docs for each mapping feature |
| FR-906 | Loading indicator for large datasets | Must | |
| FR-907 | Error toast notifications | Must | Non-blocking error display |

---

## 5. Technical Requirements

### 5.1 Architecture

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| TR-001 | Single HTML file or static site (no build step required) | Must | |
| TR-002 | No server-side processing — all transforms run in browser | Must | |
| TR-003 | Bundle the transform engine (`transform.js`) in the web app | Must | Port to browser-compatible JS |
| TR-004 | Zero npm dependencies (or minimal, explicit deps) | Must | Match project philosophy |
| TR-005 | ES modules or IIFE — no bundler required | Must | |
| TR-006 | Work offline (no CDN dependencies) | Must | All assets bundled |
| TR-007 | Graceful degradation for older browsers | Should | |

### 5.2 Browser Compatibility

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| TR-100 | Chrome/Edge (latest) | Must | |
| TR-101 | Firefox (latest) | Must | |
| TR-102 | Safari (latest) | Must | |
| TR-103 | Node.js Deno/Bun (optional) | Could | |

### 5.3 Performance

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| TR-200 | Handle datasets up to 10,000 records without freezing | Must | Virtual scrolling for trees |
| TR-201 | Preview updates within 200ms of mapping change | Must | Debounced re-render |
| TR-202 | Memory usage < 500MB for typical datasets | Should | |

### 5.4 Security

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| TR-300 | Sandbox compute functions (restricted execution context) | Must | No access to DOM, network, or global state |
| TR-301 | Sanitize file inputs (validate JSON before parsing) | Must | |
| TR-302 | No network requests (all local processing) | Must | |
| TR-303 | CSP-compatible (no inline scripts if possible) | Should | |
| TR-304 | Compute function timeout protection | Should | Prevent infinite loops |
| TR-305 | Warning dialog when loading mappings with compute functions | Must | Informed consent |

---

## 6. Mapping Spec Compatibility

The web app must generate mapping definitions compatible with the existing json-transformer engine. The mapping format supports:

```jsonc
{
  "passthrough": false,
  "schema": { /* optional validation rules */ },
  "fields": [
    {
      "field": "outputFieldName",
      "source": "sourceFieldPath",
      "type": "string" | "number" | "boolean" | "date" | "object" | "array",
      "format": "date:yyyy-MM-dd" | "number:decimal" | "uppercase" | "lowercase" | "trim",
      "map": { /* value lookup table */ },
      "default": "fallback value",
      "coalesce": ["fallback1", "fallback2"],
      "nested": [ /* sub-fields for objects */ ],
      "forEach": { /* array iteration mapping */ },
      "aggregate": "sum" | "avg" | "min" | "max" | "count" | "distinct",
      "template": "Hello ${name} from ${city}",
      "dictionary": { /* dict lookup config */ },
      "conditions": [ /* include/exclude rules */ ],
      "compute": function(a, b) { return a + b; } // JS-only feature
    }
  ]
}
```

The web app must support all features including `compute`. When compute functions are present, the app exports `.js` mappings with `export default`. Pure declarative mappings (no compute) can be exported as either `.json` or `.js`.

---

## 7. User Stories

### 7.1 First-Time User (Wizard Mode)

> As a new user, I want to load my JSON data file and be guided step-by-step through creating a mapping, so that I don't need to understand the mapping format upfront.

- Load data → see inspection summary
- For each source field: accept default mapping, customize, or skip
- Review generated mapping + live preview
- Export mapping file

### 7.2 Power User (Free-Form Mode)

> As an experienced user, I want to edit the mapping JSON directly with validation and live preview, so that I can work efficiently.

- Load data + existing mapping
- Edit mapping JSON with syntax highlighting
- See output update in real time
- Validate mapping before export

### 7.3 Visual Mapper

> As a visual learner, I want to see my source and target data side-by-side and draw connections between fields, so that I can understand the transformation intuitively.

- See source tree on left, target schema on right
- Click source field → click target field to create mapping
- See visual connections between mapped fields
- Edit mapping properties in side panel
- Preview output updates live

### 7.4 Data Migrator

> As someone migrating data between systems, I want to test my mapping against multiple sample files and compare against expected output, so that I can verify correctness before deployment.

- Load multiple source files
- Load expected output
- See diff between actual and expected
- Fix mapping iteratively

---

## 8. Out of Scope for v1

- Streaming/large-file processing
- Real-time collaboration
- Plugin/extension system
- i18n/l10n
- Mobile-responsive design
- Integration with external APIs
- Version control / mapping history
- Team sharing / cloud storage

---

## 9. Open Questions

1. **Framework choice:** Vanilla JS vs. lightweight framework (Preact, Svelte)? Given the "zero dependencies" philosophy, vanilla JS + Web Components seems aligned, but a small framework would dramatically reduce boilerplate for the tree views and reactive preview.

2. **Bundle size:** The transform engine is ~800 LoC. How large is acceptable for a single-file app? Target: < 200KB uncompressed?

3. **CSV support:** The CLI has a hand-rolled CSV parser. Should the web app include this, or defer to JSON-only for v1?

4. **Schema support:** JSON Schema validation is a complex feature. Should it be v1 or deferred?

5. **Visual mapping UX:** Click-to-link vs. drag-and-drop vs. table-based mapping? Each has tradeoffs in implementation complexity vs. user intuitiveness.

6. **localStorage persistence:** Auto-save drafts to localStorage? This raises privacy questions for sensitive data.

7. **Sample datasets:** Should the app ship with bundled sample data for demos/tutorial?

8. **Compute function sandboxing:** How to safely execute user-defined JS in the browser? Options: Web Worker isolation, restricted `new Function()` with parameter validation, or a custom expression evaluator.

9. **Compute function editor UX:** Should we provide a template picker for common operations (arithmetic, string concat, date math) plus a free-form editor for advanced users?

10. **Export format decision:** When should the app default to `.json` vs `.js` export? Should it auto-detect based on whether compute functions are present?

---

## 10. Success Criteria

- [ ] User can load a JSON file, create a mapping via wizard, preview output, and export the mapping — all without leaving the browser
- [ ] User can create compute functions (templates or custom) and see them work in live preview
- [ ] User can load an existing mapping (`.json` or `.js`), edit it visually or as code, and see live preview updates
- [ ] Generated mappings are 100% compatible with the CLI `transform.js` engine
- [ ] App loads and runs with zero server setup (open `index.html` in browser)
- [ ] All Must-priority requirements implemented
- [ ] No runtime errors in Chrome, Firefox, or Safari
- [ ] Compute functions execute safely without access to DOM, network, or global state

---

## Appendix A: Feature Priority Summary

| Category | Must | Should | Could | Won't (v1) |
|----------|------|--------|-------|------------|
| Data Loading | 4 | 1 | 2 | 0 |
| Source Tree | 4 | 3 | 0 | 0 |
| Target Schema | 3 | 2 | 2 | 0 |
| Visual Mapping | 8 | 7 | 4 | 0 |
| Wizard Mode | 7 | 2 | 0 | 0 |
| Live Preview | 3 | 3 | 2 | 0 |
| Free-Form Editor | 5 | 3 | 1 | 0 |
| Export/Import | 4 | 1 | 1 | 0 |
| Schema Integration | 0 | 0 | 4 | 0 |
| UI/UX | 4 | 3 | 2 | 0 |
| Technical | 9 | 4 | 2 | 0 |
| **Total** | **51** | **29** | **20** | **0** |

---

## Appendix B: Comparison to XSLT Tool Features

| XSLT Feature | Web App Equivalent | Status |
|-------------|-------------------|--------|
| Source XML tree viewer | JSON tree viewer (FR-100–107) | Planned |
| Target XML structure editor | Target schema definition (FR-200–206) | Planned |
| Visual node mapping | Visual mapping (FR-300–315) | Planned |
| XSD binding | JSON Schema integration (FR-800–803) | Could |
| Live transform preview | Live preview (FR-500–507) | Planned |
| Step-through debugger | N/A (no step-through in v1) | Out of scope |
| XPath evaluator | Dot-path explorer (FR-102) | Planned |
| Syntax highlighting | JSON editor highlighting (FR-601) | Planned |
| Multiple test inputs | Multi-file testing (FR-504) | Could |
| Diff viewer | Expected vs. actual diff (FR-503) | Should |
| Snippet libraries | Smart defaults / templates (FR-402) | Planned |
| Code generation | Mapping export (FR-700–706) | Planned |
| Performance profiling | Timing display (FR-505) | Could |
