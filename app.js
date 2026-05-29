/**
 * app.js — json-transformer Web Transform Assistant
 *
 * Preact-based single-page app with:
 * - Source data tree viewer
 * - Visual mapping editor (table-based)
 * - Free-form JSON/JS editor
 * - Live preview
 * - Guided wizard mode
 * - Export/import
 * - Toast notifications
 * - Dark/light theme
 */

(function () {
  "use strict";

  var h = preact.h;
  var Fragment = preact.Fragment;
  var useState = preact.useState;
  var useEffect = preact.useEffect;
  var useRef = preact.useRef;
  var useMemo = preact.useMemo;
  var useCallback = preact.useCallback;

  var MF = typeof MappingFeatures !== "undefined" ? MappingFeatures : null;
  var SM = typeof SampleMappings !== "undefined" ? SampleMappings : null;

  // ── Sample datasets (bundled) ──────────────────────────────────────

  var SAMPLE_EMPLOYEES = [
    { id: "E001", fullName: "Alice Johnson", department: "Engineering", role: "Senior Developer", salary: 95000, hireDate: "2020-03-15", active: true, address: { city: "San Francisco", state: "CA", zip: "94102" } },
    { id: "E002", fullName: "Bob Smith", department: "Marketing", role: "Marketing Manager", salary: 82000, hireDate: "2019-07-22", active: true, address: { city: "New York", state: "NY", zip: "10001" } },
    { id: "E003", fullName: "Carol Davis", department: "Engineering", role: "Junior Developer", salary: 65000, hireDate: "2023-01-10", active: true, address: { city: "Austin", state: "TX", zip: "73301" } },
  ];

  /** Matches mapping-employee.js / samples/test-employees.json field names */
  var COMPOSITE_EMPLOYEES = [
    { EmployeeName: "Jane Smith", Department: "Engineering", Level: "senior", Status: "active", YearsEmployed: 5, Salary: 120000, EmployeeType: "fulltime", Title: "Senior Engineer", HourlyRate: 0, Email: "jane@example.com", EmergencyPhone: "555-0101", BirthYear: 1985 },
    { EmployeeName: "Bob Jones", Department: "Data", Level: "staff", Status: "active", YearsEmployed: 3, Salary: 95000, EmployeeType: "fulltime", Title: "Staff Data Scientist", HourlyRate: 0, Email: "bob@example.com", BirthYear: 1990 },
    { EmployeeName: "Alice Temp", Department: "Engineering", Level: "senior", Status: "active", YearsEmployed: 2, Salary: 80000, EmployeeType: "contractor", Title: "Contract Senior Dev", HourlyRate: 0, Email: "alice@contractor.com", BirthYear: 1988 },
    { EmployeeName: "Tom Sales", Department: "Sales", Level: "junior", Status: "inactive", YearsEmployed: 1, Salary: 45000, EmployeeType: "fulltime", Title: "Sales Associate", HourlyRate: 0, Email: "tom@example.com", BirthYear: 1995 },
    { EmployeeName: "CEO Sarah", Department: "Management", Level: "executive", Status: "active", YearsEmployed: 10, Salary: 250000, EmployeeType: "fulltime", Title: "Chief Executive Officer", HourlyRate: 0, Email: "sarah@example.com", BirthYear: 1975 },
  ];

  var COMPANION_SOURCE_BY_MAPPING_ID = {
    "employee-import": COMPOSITE_EMPLOYEES,
  };

  var SAMPLE_ORDERS = [
    { orderId: "ORD-1001", customerName: "Acme Corp", items: [{ sku: "WIDGET-A", qty: 5, price: 29.99 }, { sku: "WIDGET-B", qty: 2, price: 49.99 }], status: "shipped", orderDate: "2024-11-15" },
    { orderId: "ORD-1002", customerName: "Globex Inc", items: [{ sku: "GADGET-X", qty: 1, price: 199.99 }], status: "pending", orderDate: "2024-11-18" },
  ];

  var SAMPLE_DATASETS = [
    { name: "Employees (nested objects)", data: SAMPLE_EMPLOYEES },
    { name: "Employee conditions (CLI demo)", data: COMPOSITE_EMPLOYEES },
    { name: "Orders (arrays)", data: SAMPLE_ORDERS },
  ];

  // ── Toast system ───────────────────────────────────────────────────

  var toasts = [];
  var toastSubscribers = [];

  function showToast(message, type, duration) {
    type = type || "info";
    duration = duration || 4000;
    var id = Date.now() + Math.random();
    toasts.push({ id, message, type });
    notifySubscribers();
    if (duration > 0) {
      setTimeout(function () { removeToast(id); }, duration);
    }
  }

  function removeToast(id) {
    toasts = toasts.filter(function (t) { return t.id !== id; });
    notifySubscribers();
  }

  function useToasts() {
    var _a = useState(toasts.slice()), localToasts = _a[0], setLocalToasts = _a[1];
    useEffect(function () {
      function onToastsChange() { setLocalToasts(toasts.slice()); }
      toastSubscribers.push(onToastsChange);
      return function () { toastSubscribers = toastSubscribers.filter(function (s) { return s !== onToastsChange; }); };
    }, []);
    return localToasts;
  }

  function notifySubscribers() {
    toastSubscribers.forEach(function (fn) { try { fn(); } catch (e) { } });
  }

  // ── Theme ──────────────────────────────────────────────────────────

  function getTheme() {
    return localStorage.getItem("jt-theme") || "light";
  }

  function setTheme(theme) {
    localStorage.setItem("jt-theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  }

  // ── Utility helpers ────────────────────────────────────────────────

  function getType(value) {
    if (value === null || value === undefined) return "null";
    if (Array.isArray(value)) return "array";
    return typeof value;
  }

  function truncate(str, max) {
    max = max || 40;
    if (typeof str !== "string") str = JSON.stringify(str);
    return str.length > max ? str.slice(0, max) + "..." : str;
  }

  function downloadFile(content, filename, mimeType) {
    mimeType = mimeType || "application/json";
    var blob = new Blob([content], { type: mimeType });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function copyToClipboard(text) {
    function onSuccess() { showToast("Copied to clipboard", "success", 2000); }
    function onFail() { showToast("Failed to copy", "error"); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onSuccess, onFail);
      return;
    }
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      onSuccess();
    } catch (e) {
      onFail();
    }
  }

  function mappingHasCompute(obj) {
    return MF ? MF.mappingHasCompute(obj) : false;
  }

  function parseMappingFromCode(text, mode) {
    if (!text || !String(text).trim()) return null;
    if (mode === "json") {
      return JSON.parse(text);
    }
    if (MF && MF.parseMappingModule) {
      return MF.parseMappingModule(text);
    }
    return new Function("return (" + String(text).trim() + ")")();
  }

  function dataHasTopLevelField(data, fieldName) {
    if (!data || !fieldName) return false;
    var rows = Array.isArray(data) ? data : [data];
    return rows.some(function (row) {
      return row && Object.prototype.hasOwnProperty.call(row, fieldName);
    });
  }

  function treeNodeMatchesSearch(path, nodeKey, value, query) {
    if (!query) return true;
    var q = query.toLowerCase();
    if (nodeKey && String(nodeKey).toLowerCase().indexOf(q) >= 0) return true;
    if (path && String(path).toLowerCase().indexOf(q) >= 0) return true;
    if (getType(value) === "string" && String(value).toLowerCase().indexOf(q) >= 0) return true;
    return false;
  }

  function treeHasMatchingDescendant(value, path, query) {
    if (!query) return true;
    if (treeNodeMatchesSearch(path, null, value, query)) return true;
    var type = getType(value);
    if (type === "object") {
      return Object.keys(value).some(function (k) {
        var childPath = path != null && path !== "" ? path + "." + k : k;
        return treeNodeMatchesSearch(childPath, k, value[k], query) ||
          treeHasMatchingDescendant(value[k], childPath, query);
      });
    }
    if (type === "array") {
      return value.some(function (item, i) {
        var childPath = path != null && path !== "" ? path + "." + i : String(i);
        return treeHasMatchingDescendant(item, childPath, query);
      });
    }
    return false;
  }

  function visualFieldsFromMapping(mapping) {
    return MF ? MF.visualFieldsFromMapping(mapping) : [];
  }

  function buildMappingFromVisual(fields, passthrough, meta) {
    if (!MF) return { fields: {} };
    return MF.buildFullMapping(fields, {
      passthrough: passthrough === true,
      meta: meta || {},
    });
  }

  function resolveActiveMapping(editorMode, mappingFields, codeEditorValue, passthrough, mappingMeta, codeSnapshot) {
    if (!MF) return null;
    if (editorMode === "visual") {
      if (codeSnapshot && codeSnapshot.mapping) {
        return MF.mergeVisualFieldsIntoMapping(mappingFields, codeSnapshot.mapping, {
          passthrough: passthrough === true,
          meta: mappingMeta,
        });
      }
      return buildMappingFromVisual(mappingFields, passthrough, mappingMeta);
    }
    if (!codeEditorValue || !String(codeEditorValue).trim()) return null;
    if (editorMode === "json") {
      return MF.applyMappingMeta(JSON.parse(codeEditorValue), mappingMeta);
    }
    var parsed = MF.applyMappingMeta(MF.parseMappingModule(codeEditorValue), mappingMeta);
    if (
      codeSnapshot &&
      codeSnapshot.mapping &&
      codeSnapshot.mode === "js" &&
      MF.mappingHasCompute(codeSnapshot.mapping) &&
      String(codeEditorValue).trim() === String(codeSnapshot.text).trim()
    ) {
      return MF.applyMappingMeta(codeSnapshot.mapping, mappingMeta);
    }
    return parsed;
  }

  function parseImportedMapping(text, fileName) {
    var isJson = /\.json$/i.test(fileName);
    var isJs = /\.js$/i.test(fileName);
    var mapping;
    var bodyText;

    if (isJson) {
      mapping = JSON.parse(text);
      bodyText = JSON.stringify(mapping, null, 2);
    } else if (isJs) {
      mapping = MF.parseMappingModule(text);
      // Keep full file text in the editor (export, comments, all field defs)
      bodyText = String(text).replace(/^\uFEFF/, "").trim();
    } else {
      throw new Error("Unsupported file type (use .json or .js)");
    }

    var meta = MF.extractMappingMeta(mapping);
    var useCodeEditor = MF.mappingRequiresCodeEditor(mapping) || MF.mappingHasCompute(mapping);
    var visualFields = MF.visualFieldsFromMapping(mapping);
    var fieldCount = Object.keys(mapping.fields || {}).length;
    var advancedCount = visualFields.filter(function (f) {
      return f.kind === "advanced" || f.kind === "condition" || f.kind === "template" || f.kind === "static";
    }).length;

    return {
      mapping: mapping,
      meta: meta,
      editorMode: useCodeEditor ? (isJs ? "js" : "json") : "visual",
      codeEditorValue: bodyText,
      // Avoid visual↔code sync overwriting imported JS (see useEffect in App)
      mappingFields: useCodeEditor ? [] : visualFields,
      fieldSummary: MF.fieldSummaryFromMapping(mapping),
      passthrough: MF.passthroughToBool(meta.passthrough),
      toast: useCodeEditor
        ? {
          message: "Imported " + fileName + " (" + fieldCount + " fields, " + advancedCount + " advanced). Edit in " + (isJs ? "JS" : "JSON") + " mode; see field list below.",
          type: "info",
          duration: 6000,
        }
        : { message: "Imported " + fileName + " (" + fieldCount + " fields)", type: "success", duration: 3000 },
    };
  }

  // ── Tree Node Component ────────────────────────────────────────────

  function TreeNode(props) {
    var nodeKey = props.nodeKey;
    var value = props.value;
    var path = props.path;
    var onSelect = props.onSelect;
    var selectedPath = props.selectedPath;
    var searchQuery = props.searchQuery;
    var sourceData = props.sourceData;
    var depth = props.depth || 0;

    if (searchQuery && !treeHasMatchingDescendant(value, path, searchQuery)) {
      return null;
    }

    var type = getType(value);
    var isExpandable = type === "object" || type === "array";
    var isSelected = path === selectedPath;

    var _useState = useState(function () {
      if (searchQuery) return true;
      if (isExpandable && depth === 0) return true;
      return depth > 0;
    }), expanded = _useState[0], setExpanded = _useState[1];

    useEffect(function () {
      if (searchQuery) setExpanded(true);
    }, [searchQuery]);

    function handleClick() {
      if (isExpandable) {
        setExpanded(function (e) { return !e; });
      }
      if (onSelect) {
        onSelect(path, value, type);
      }
    }

    function renderValue() {
      if (type === "null") return h("span", { className: "tree-value tree-value-primitive" }, "null");
      if (type === "boolean") return h("span", { className: "tree-value tree-value-primitive" }, String(value));
      if (type === "number") return h("span", { className: "tree-value tree-value-primitive" }, String(value));
      if (type === "string") {
        var display = truncate(value, 48);
        return h("span", { className: "tree-value tree-value-string", title: value }, "\"" + display + "\"");
      }
      if (type === "array") return h("span", { className: "tree-value tree-value-meta" }, "[" + value.length + " items]");
      if (type === "object") {
        var keys = Object.keys(value);
        return h("span", { className: "tree-value tree-value-meta" }, "{" + keys.length + " fields}");
      }
      return null;
    }

    var sampleHint = null;
    if (path && MF && sourceData && (type === "string" || type === "number" || type === "boolean")) {
      var samples = MF.getSampleValuesForPath(sourceData, path, 3);
      if (samples.length) {
        sampleHint = h("span", { className: "tree-samples", title: "Sample values" }, " eg. " + samples.join(", "));
      }
    }

    var children = [
      h("div", {
        className: "tree-node-content" + (isSelected ? " selected" : "") + (isExpandable ? "" : " tree-node-leaf"),
        onClick: handleClick,
        style: { paddingLeft: (depth * 12 + 6) + "px" },
      },
        isExpandable ? h("span", { className: "tree-toggle" }, expanded ? "\u25BC" : "\u25B6") : h("span", { className: "tree-toggle" }),
        h("span", { className: "tree-label" },
          nodeKey ? h("span", {
            className: "tree-key",
            title: path && path !== nodeKey ? nodeKey + " — path: " + path : nodeKey,
          }, nodeKey) : null,
          h("span", { className: "tree-type " + type }, type)
        ),
        h("span", { className: "tree-value-wrap" }, renderValue(), sampleHint)
      )
    ];

    if (isExpandable && expanded) {
      children.push(h("div", { className: "tree-children" },
        type === "array" ? value.map(function (item, i) {
          return h(TreeNode, {
            key: "arr-" + i,
            nodeKey: "[" + i + "]",
            value: item,
            path: path != null && path !== "" ? path + "." + i : String(i),
            onSelect: onSelect,
            selectedPath: selectedPath,
            searchQuery: searchQuery,
            sourceData: sourceData,
            depth: depth + 1,
          });
        }) : Object.keys(value).map(function (k) {
          return h(TreeNode, {
            key: "obj-" + k,
            nodeKey: k,
            value: value[k],
            path: path != null && path !== "" ? path + "." + k : k,
            onSelect: onSelect,
            selectedPath: selectedPath,
            searchQuery: searchQuery,
            sourceData: sourceData,
            depth: depth + 1,
          });
        })
      ));
    }

    return h("div", { className: "tree-node" }, children);
  }

  // ── Source Tree Panel ──────────────────────────────────────────────

  function SourceTreePanel(props) {
    var data = props.data;
    var onSelect = props.onSelect;
    var collapsed = props.collapsed;
    var onToggleCollapse = props.onToggleCollapse;
    var _useState = useState(""), searchQuery = _useState[0], setSearchQuery = _useState[1];
    var selectedPath = props.selectedPath;

    var filteredData = data;

    if (!data) {
      return h("div", { className: "panel panel-source" + (collapsed ? " panel-collapsed" : "") },
        h("div", { className: "panel-header" },
          h("span", { className: "panel-title" }, collapsed ? "" : "Source Data"),
          onToggleCollapse ? h("button", { type: "button", className: "btn btn-sm btn-secondary", onClick: onToggleCollapse }, collapsed ? "\u25B6" : "\u25C0") : null
        ),
        h("div", { className: "panel-body" },
          h("div", { className: "empty-state" },
            h("div", { className: "empty-state-icon" }, "\uD83D\uDCC4"),
            h("div", { className: "empty-state-text" }, "No data loaded"),
            h("div", { className: "empty-state-text" }, "Load a JSON file or use sample data")
          )
        )
      );
    }

    return h("div", { className: "panel panel-source" + (collapsed ? " panel-collapsed" : "") },
      h("div", { className: "panel-header" },
        h("span", { className: "panel-title" }, collapsed ? "Src" : "Source Data"),
        collapsed ? null : h("span", { className: "text-sm text-muted" }, Array.isArray(data) ? data.length + " records" : "1 object"),
        onToggleCollapse ? h("button", { type: "button", className: "btn btn-sm btn-secondary", onClick: onToggleCollapse }, collapsed ? "\u25B6" : "\u25C0") : null
      ),
      collapsed ? null : [
      h("input", {
        className: "tree-search",
        type: "search",
        placeholder: "Search fields...",
        value: searchQuery,
        onInput: function (e) { setSearchQuery(e.target.value); },
      }),
      h("div", { className: "panel-body tree" },
        Array.isArray(filteredData) ? filteredData.map(function (record, i) {
          return h(TreeNode, {
            key: "record-" + i,
            nodeKey: "Record " + (i + 1),
            value: record,
            path: String(i),
            onSelect: onSelect,
            selectedPath: selectedPath,
            searchQuery: searchQuery,
            sourceData: data,
            depth: 0,
          });
        }) : h(TreeNode, {
          key: "root",
          nodeKey: "root",
          value: filteredData,
          path: null,
          onSelect: onSelect,
          selectedPath: selectedPath,
          searchQuery: searchQuery,
          sourceData: data,
          depth: 0,
        })
      )
      ]
    );
  }

  // ── Mapping Editor (Table-based) ───────────────────────────────────

  function NestedFieldsEditor(props) {
    var nestedFields = props.fields || [];
    var onChange = props.onChange;
    var depth = props.depth || 0;

    function updateChild(ci, updated) {
      var next = nestedFields.slice();
      next[ci] = updated;
      onChange(next);
    }

    function addChild() {
      var next = nestedFields.slice();
      next.push(MF.defaultVisualField({ target: "field_" + (next.length + 1), kind: "simple" }));
      onChange(next);
    }

    return h("div", { className: "nested-fields-editor", style: { marginLeft: depth ? "12px" : "0" } },
      nestedFields.map(function (nf, ci) {
        return h(MappingFieldRow, {
          key: ci,
          field: nf,
          index: ci,
          onChange: function (_, u) { updateChild(ci, u); },
          onRemove: function (idx) {
            var next = nestedFields.slice();
            next.splice(idx, 1);
            onChange(next);
          },
          onMove: function () { },
          totalFields: nestedFields.length,
          compact: true,
          hideKindSelect: true,
        });
      }),
      h("button", { type: "button", className: "btn btn-sm btn-secondary mt-1", onClick: addChild }, "+ Nested field")
    );
  }

  function MappingFieldRow(props) {
    var field = props.field;
    var index = props.index;
    var onChange = props.onChange;
    var onRemove = props.onRemove;
    var onMove = props.onMove;
    var compact = props.compact;
    var hideKindSelect = props.hideKindSelect;
    var rowError = props.rowError;

    function update(key, value) {
      var updated = Object.assign({}, field, {});
      updated[key] = value;
      if (key === "kind") {
        if (value === "forEach" || value === "nested") {
          if (!updated.nestedFields || !updated.nestedFields.length) {
            updated.nestedFields = [MF.defaultVisualField({ target: "item_field", kind: "simple" })];
          }
        }
        if (value === "compute" && MF) {
          var tpl = MF.COMPUTE_TEMPLATES[0];
          updated.computeTemplate = tpl.id;
          updated.computeCode = tpl.code;
        }
      }
      if (key === "computeTemplate" && MF) {
        var t = MF.COMPUTE_TEMPLATES.find(function (x) { return x.id === value; });
        if (t) {
          updated.computeCode = t.code;
        }
      }
      onChange(index, updated);
    }

    var kind = field.kind || "simple";
    var templates = MF ? MF.COMPUTE_TEMPLATES : [];

    if (kind === "condition" || kind === "template" || kind === "static" || kind === "advanced") {
      var kindLabels = {
        condition: "Condition (if/then/else)",
        template: "Template",
        static: "Static value",
        advanced: "Advanced",
      };
      return h("div", { className: "mapping-field-row mapping-field-readonly" },
        h("div", { className: "mapping-field-row-main" },
          h("div", null,
            h("label", { className: "mapping-field-label" }, "Destination"),
            h("div", { className: "font-mono text-sm font-bold" }, field.target || "(unnamed)")
          ),
          h("div", null,
            h("label", { className: "mapping-field-label" }, "Type"),
            h("span", { className: "mapping-kind-badge" }, kindLabels[kind] || "Advanced")
          ),
          !compact ? h("div", { className: "mapping-field-actions" },
            h("button", {
              type: "button",
              className: "btn btn-sm btn-danger",
              onClick: function () { onRemove(index); },
              title: "Remove from visual list only",
            }, "\u2715")
          ) : null
        ),
        field.advancedSummary ? h("div", { className: "mapping-advanced-summary" }, field.advancedSummary) : null,
        field.advancedDefJson ? h("pre", { className: "mapping-advanced-def" }, field.advancedDefJson) : null,
        h("div", { className: "mapping-readonly-footnote" }, "Preserved from JS/JSON — edit the full rule in code mode")
      );
    }

    return h("div", { className: "mapping-field-row" + (rowError ? " has-error" : "") },
      rowError ? h("div", { className: "mapping-row-error" }, rowError) : null,
      h("div", { className: "mapping-field-row-main" },
        h("div", null,
          h("label", { className: "mapping-field-label" }, "Target Field"),
          h("input", {
            className: "mapping-field-input",
            type: "text",
            value: field.target || "",
            placeholder: "output_field_name",
            onInput: function (e) { update("target", e.target.value); },
          })
        ),
        kind === "simple" || kind === "compute" ? h("div", null,
          h("label", { className: "mapping-field-label" },
            kind === "compute" ? "Source Path(s)" : "Source Path"
          ),
          h("input", {
            className: "mapping-field-input",
            type: "text",
            value: kind === "compute" ? (field.computeSources || field.source || "") : (field.source || ""),
            placeholder: kind === "compute" ? "path.a, path.b" : "source.field.path",
            onInput: function (e) {
              if (kind === "compute") update("computeSources", e.target.value);
              else update("source", e.target.value);
            },
            list: "field-suggestions",
          })
        ) : h("div", null,
          h("label", { className: "mapping-field-label" }, kind === "forEach" ? "Array Path (forEach)" : "Object root"),
          h("input", {
            className: "mapping-field-input",
            type: "text",
            value: field.forEachPath || field.source || "",
            placeholder: "items",
            onInput: function (e) { update("forEachPath", e.target.value); },
            list: "field-suggestions",
          })
        ),
        !compact ? h("div", { className: "mapping-field-actions" },
          h("button", { type: "button", className: "btn btn-sm btn-secondary", onClick: function () { onMove(index, -1); }, disabled: index === 0 }, "\u25B2"),
          h("button", { type: "button", className: "btn btn-sm btn-secondary", onClick: function () { onMove(index, 1); }, disabled: index === (props.totalFields - 1) }, "\u25BC"),
          h("button", { type: "button", className: "btn btn-sm btn-danger", onClick: function () { onRemove(index); } }, "\u2715")
        ) : h("div", { className: "mapping-field-actions" },
          h("button", { type: "button", className: "btn btn-sm btn-danger", onClick: function () { onRemove(index); } }, "\u2715")
        )
      ),
      !hideKindSelect && !compact ? h("div", { className: "mapping-field-options" },
        h("div", null,
          h("label", { className: "mapping-field-label" }, "Mapping Type"),
          h("select", { value: kind, onChange: function (e) { update("kind", e.target.value); } },
            h("option", { value: "simple" }, "Field map"),
            h("option", { value: "forEach" }, "Array (forEach)"),
            h("option", { value: "nested" }, "Nested object"),
            h("option", { value: "compute" }, "Compute")
          )
        ),
        kind === "simple" ? h("div", null,
          h("label", { className: "mapping-field-label" }, "Type"),
          h("select", { value: field.type || "auto", onChange: function (e) { update("type", e.target.value); } },
            h("option", { value: "auto" }, "Auto"),
            h("option", { value: "string" }, "String"),
            h("option", { value: "number" }, "Number"),
            h("option", { value: "boolean" }, "Boolean"),
            h("option", { value: "date" }, "Date")
          )
        ) : null,
        kind === "simple" || kind === "compute" ? h("div", null,
          h("label", { className: "mapping-field-label" }, "Format"),
          h("select", { value: field.format || "", onChange: function (e) { update("format", e.target.value); } },
            h("option", { value: "" }, "None"),
            h("option", { value: "uppercase" }, "Uppercase"),
            h("option", { value: "lowercase" }, "Lowercase"),
            h("option", { value: "titlecase" }, "Title Case"),
            h("option", { value: "trim" }, "Trim"),
            h("option", { value: "number" }, "Number"),
            h("option", { value: "date" }, "Date")
          )
        ) : null,
        kind === "simple" ? h("div", null,
          h("label", { className: "mapping-field-label" }, "Default"),
          h("input", { className: "mapping-field-input", type: "text", value: field.default || "", onInput: function (e) { update("default", e.target.value); } })
        ) : null,
        kind === "simple" ? h("div", null,
          h("label", { className: "mapping-field-label" }, "Coalesce"),
          h("input", {
            className: "mapping-field-input",
            type: "text",
            value: field.coalesce || "",
            placeholder: "alt.path, other.path",
            onInput: function (e) { update("coalesce", e.target.value); },
          })
        ) : null,
        kind === "simple" ? h("div", null,
          h("label", { className: "mapping-field-label" }, "Value map"),
          h("input", {
            className: "mapping-field-input",
            type: "text",
            value: field.mapPairs || "",
            placeholder: "old:new, yes:1",
            onInput: function (e) { update("mapPairs", e.target.value); },
          })
        ) : null
      ) : null,
      kind === "compute" && !compact ? h("div", { className: "mapping-field-options" },
        h("div", null,
          h("label", { className: "mapping-field-label" }, "Template"),
          h("select", {
            value: field.computeTemplate || "concat",
            onChange: function (e) { update("computeTemplate", e.target.value); },
          },
            templates.map(function (t) {
              return h("option", { key: t.id, value: t.id }, t.label);
            })
          )
        ),
        h("div", { className: "mapping-compute-code-wrap" },
          h("label", { className: "mapping-field-label" }, "Expression (use a, b, c…)"),
          h("textarea", {
            className: "mapping-compute-code",
            value: field.computeCode || "",
            rows: 3,
            onInput: function (e) { update("computeCode", e.target.value); },
          })
        )
      ) : null,
      (kind === "forEach" || kind === "nested") && !compact ? h("div", { className: "mapping-nested-block" },
        h("div", { className: "mapping-field-label mb-1" }, "Nested field mappings"),
        h(NestedFieldsEditor, {
          fields: field.nestedFields || [],
          onChange: function (nf) { update("nestedFields", nf); },
        })
      ) : null
    );
  }

  function VisualMappingEditor(props) {
    var fields = props.fields;
    var onChange = props.onChange;
    var inspection = props.inspection;
    var passthrough = props.passthrough;
    var onPassthroughChange = props.onPassthroughChange;
    var sourceData = props.sourceData;
    var validationErrors = props.validationErrors || [];

    function addField() {
      var newFields = fields.slice();
      newFields.push(MF.defaultVisualField({
        target: "new_field_" + (newFields.length + 1),
        kind: "simple",
      }));
      onChange(newFields);
    }

    function updateField(index, updated) {
      var newFields = fields.slice();
      newFields[index] = updated;
      onChange(newFields);
    }

    function removeField(index) {
      var newFields = fields.slice();
      newFields.splice(index, 1);
      onChange(newFields);
    }

    function moveField(index, direction) {
      var newIndex = index + direction;
      if (newIndex < 0 || newIndex >= fields.length) return;
      var newFields = fields.slice();
      var temp = newFields[index];
      newFields[index] = newFields[newIndex];
      newFields[newIndex] = temp;
      onChange(newFields);
    }

    function errorForIndex(i) {
      var msgs = validationErrors.filter(function (e) { return e.index === i; }).map(function (e) { return e.message; });
      return msgs.length ? msgs.join("; ") : "";
    }

    return h("div", { className: "mapping-editor" },
      h("div", { className: "mapping-toolbar" },
        h("label", { className: "mapping-passthrough" },
          h("input", {
            type: "checkbox",
            checked: !!passthrough,
            onChange: function (e) { onPassthroughChange(e.target.checked); },
          }),
          " Passthrough (include unmapped source fields)"
        ),
        h("button", { type: "button", className: "btn btn-sm btn-primary", onClick: addField }, "+ Add Field")
      ),
      validationErrors.length > 0 ? h("div", { className: "mapping-validation-summary" },
        validationErrors.length + " mapping issue(s) — check highlighted rows"
      ) : null,
      fields.some(function (f) {
        return f.kind === "advanced" || f.kind === "condition" || f.kind === "template" || f.kind === "static";
      })
        ? h("div", { className: "mapping-readonly-hint" },
            "Condition and advanced rules are shown read-only. Edit them in JS/JSON mode; simple field rows remain editable here."
          )
        : null,
      fields.length === 0 ? h("div", { className: "empty-state" },
        h("div", { className: "empty-state-icon" }, "\uD83D\uDC64"),
        h("div", { className: "empty-state-text" }, "No fields mapped yet"),
        h("div", { className: "empty-state-text" }, "Click \"+ Add Field\" or run the Wizard")
      ) : fields.map(function (field, i) {
        return h(MappingFieldRow, {
          key: i,
          field: field,
          index: i,
          onChange: updateField,
          onRemove: removeField,
          onMove: moveField,
          totalFields: fields.length,
          rowError: errorForIndex(i),
        });
      }),
      h("datalist", { id: "field-suggestions" },
        (inspection ? Object.keys(inspection.fields || {}) : []).map(function (f) {
          return h("option", { key: f, value: f });
        })
      )
    );
  }

  // ── Mapping field outline (read-only summary for JSON/JS imports) ───

  function MappingFieldOutline(props) {
    var summary = props.summary || [];
    if (!summary.length) return null;
    return h("div", { className: "mapping-field-outline" },
      h("div", { className: "mapping-field-outline-title" },
        summary.length + " destination field" + (summary.length === 1 ? "" : "s")
      ),
      h("ul", { className: "mapping-field-outline-list" },
        summary.map(function (row) {
          return h("li", { key: row.target, className: "mapping-field-outline-item kind-" + row.kind },
            h("span", { className: "mapping-field-outline-target font-mono" }, row.target),
            h("span", { className: "mapping-field-outline-meta text-sm text-muted" },
              row.kind === "advanced" ? "advanced (edit in JSON/JS)" : (row.label || row.kind)
            )
          );
        })
      )
    );
  }

  // ── Code Editor (Free-form) ────────────────────────────────────────

  function CodeEditor(props) {
    var mode = props.mode; // "json" or "js"
    var value = props.value;
    var onChange = props.onChange;
    var _useState = useState(""), error = _useState[0], setError = _useState[1];

    function validateText(text) {
      if (!text || !String(text).trim()) {
        setError("");
        return;
      }
      if (mode === "json") {
        JSON.parse(text);
      } else if (MF && MF.parseMappingModule) {
        MF.parseMappingModule(text);
      } else {
        new Function("return (" + text + ")")();
      }
      setError("");
    }

    useEffect(function () {
      try {
        validateText(value);
      } catch (e) {
        setError(e.message);
      }
    }, [value, mode]);

    function handleInput(e) {
      var text = e.target.value;
      onChange(text);
      try {
        validateText(text);
      } catch (e) {
        setError(e.message);
      }
    }

    function formatJson() {
      try {
        var parsed = JSON.parse(value);
        var formatted = JSON.stringify(parsed, null, 2);
        onChange(formatted);
        setError("");
      } catch (e) {
        setError("Cannot format: " + e.message);
      }
    }

    return h("div", { className: "code-editor-wrap" },
      props.fieldSummary && props.fieldSummary.length
        ? h(MappingFieldOutline, { summary: props.fieldSummary })
        : null,
      h("div", { className: "flex justify-between items-center mb-1" },
        h("span", { className: "font-bold text-sm" }, mode === "json" ? "JSON Mapping" : "JS Mapping"),
        h("div", { className: "flex gap-1" },
          mode === "json" ? h("button", { type: "button", className: "btn btn-sm btn-secondary", onClick: formatJson }, "Format") : null,
          h("button", {
            type: "button",
            className: "btn btn-sm btn-secondary",
            onClick: function () { copyToClipboard(value); },
          }, "Copy")
        )
      ),
      h("textarea", {
        className: "code-editor" + (error ? " error" : ""),
        value: value,
        onInput: handleInput,
        spellcheck: false,
      }),
      error ? h("div", { className: "validation-error" }, "\u26A0 " + error) : null,
      !error && value.trim() ? h("div", { className: "validation-ok" }, "\u2713 Valid " + mode.toUpperCase()) : null
    );
  }

  // ── Preview Panel ──────────────────────────────────────────────────

  function PreviewPanel(props) {
    var output = props.output;
    var errors = props.errors;
    var expectedOutput = props.expectedOutput;
    var previewLimit = props.previewLimit;
    var onPreviewLimitChange = props.onPreviewLimitChange;
    var onClearPreview = props.onClearPreview;
    var onLoadExpected = props.onLoadExpected;
    var _useState = useState(0), recordIndex = _useState[0], setRecordIndex = _useState[1];
    var _useState2 = useState(false), showDiff = _useState2[0], setShowDiff = _useState2[1];

    var totalRecords = Array.isArray(output) ? output.length : (output ? 1 : 0);

    useEffect(function () {
      setRecordIndex(0);
    }, [output, totalRecords]);

    function getDisplayRecord() {
      if (!output) return null;
      if (Array.isArray(output)) {
        return output[recordIndex] || output[0];
      }
      return output;
    }

    function getExpectedRecord() {
      if (!expectedOutput) return null;
      if (Array.isArray(expectedOutput)) {
        return expectedOutput[recordIndex] || expectedOutput[0];
      }
      return expectedOutput;
    }

    var actual = getDisplayRecord();
    var expected = getExpectedRecord();
    var diffLines = showDiff && expected != null && actual != null && MF
      ? MF.diffRecords(expected, actual)
      : null;

    return h("div", { className: "panel panel-preview" + (props.collapsed ? " panel-collapsed" : "") },
      h("div", { className: "panel-header" },
        h("span", { className: "panel-title" }, "Preview"),
        h("div", { className: "flex gap-1 items-center" },
          props.onToggleCollapse ? h("button", {
            type: "button",
            className: "btn btn-sm btn-secondary",
            onClick: props.onToggleCollapse,
            title: "Collapse panel",
          }, props.collapsed ? "\u25B6" : "\u25C0") : null,
          errors && errors.length > 0
            ? h("span", { className: "text-sm", style: { color: "var(--danger)" } }, errors.length + " err")
            : h("span", { className: "text-sm text-muted" }, totalRecords + " shown")
        )
      ),
      h("div", { className: "preview-controls" },
        h("label", { className: "text-sm" }, "Records:"),
        h("input", {
          type: "number",
          className: "preview-limit-input",
          min: 1,
          max: 1000,
          value: previewLimit,
          onInput: function (e) { onPreviewLimitChange(Math.max(1, parseInt(e.target.value, 10) || 5)); },
        }),
        h("button", { type: "button", className: "btn btn-sm btn-secondary", onClick: onLoadExpected }, "Load expected"),
        expectedOutput ? h("button", {
          type: "button",
          className: "btn btn-sm " + (showDiff ? "btn-primary" : "btn-secondary"),
          onClick: function () { setShowDiff(!showDiff); },
        }, "Diff") : null,
        h("button", { type: "button", className: "btn btn-sm btn-secondary", onClick: onClearPreview }, "Clear")
      ),
      Array.isArray(output) && output.length > 1 ? h("div", { className: "preview-record-nav" },
        h("button", { type: "button", className: "btn btn-sm btn-secondary", onClick: function () { setRecordIndex(function (i) { return Math.max(0, i - 1); }); }, disabled: recordIndex === 0 }, "\u25C0"),
        h("span", { className: "preview-record-count" }, "Record " + (recordIndex + 1) + " / " + output.length),
        h("button", { type: "button", className: "btn btn-sm btn-secondary", onClick: function () { setRecordIndex(function (i) { return Math.min(output.length - 1, i + 1); }); }, disabled: recordIndex >= output.length - 1 }, "\u25B6")
      ) : null,
      h("div", { className: "panel-body" },
        showDiff && diffLines ? h("div", { className: "preview-diff" },
          diffLines.map(function (line, i) {
            return h("div", { key: i, className: "diff-line diff-" + line.type }, line.text);
          })
        ) : output ? h("pre", { className: "preview-output" }, JSON.stringify(actual, null, 2))
          : h("div", { className: "empty-state" },
              h("div", { className: "empty-state-icon" }, "\uD83D\uDCC1"),
              h("div", { className: "empty-state-text" }, "No output yet"),
              h("div", { className: "empty-state-text" }, "Load data and create a mapping")
            ),
        errors && errors.length > 0 ? h("div", { className: "preview-errors" },
          h("div", { className: "font-bold text-sm mb-1" }, "Errors"),
          errors.map(function (err, i) {
            return h("div", { key: i, className: "validation-error mb-1" },
              (err.row != null ? "Row " + err.row + ": " : "") +
              (err.field ? err.field + " - " : "") +
              (err.message || "error")
            );
          })
        ) : null
      )
    );
  }

  // ── Data Inspector ─────────────────────────────────────────────────

  function DataInspector(props) {
    var inspection = props.inspection;
    if (!inspection) return null;

    return h("div", { className: "inspector" },
      h("div", { className: "inspector-stat" },
        h("span", { className: "inspector-stat-label" }, "Records"),
        h("span", { className: "inspector-stat-value" }, inspection.recordCount)
      ),
      h("div", { className: "inspector-stat" },
        h("span", { className: "inspector-stat-label" }, "Fields"),
        h("span", { className: "inspector-stat-value" }, Object.keys(inspection.fields || {}).length)
      ),
      Object.entries(inspection.fields || {}).slice(0, 10).map(function (_a) {
        var field = _a[0], info = _a[1];
        return h("div", { key: field, className: "inspector-stat" },
          h("span", { className: "inspector-stat-label font-mono" }, field),
          h("span", { className: "inspector-stat-value" }, info.type + (info.min !== undefined ? " [" + info.min + "-" + info.max + "]" : ""))
        );
      })
    );
  }

  // ── Wizard Modal ───────────────────────────────────────────────────

  function WizardModal(props) {
    var open = props.open;
    var onClose = props.onClose;
    var data = props.data;
    var inspection = props.inspection;
    var onComplete = props.onComplete;

    var _useState = useState(0), step = _useState[0], setStep = _useState[1];
    var _useState2 = useState([]), answers = _useState2[0], setAnswers = _useState2[1];
    var _useState3 = useState(false), passthrough = _useState3[0], setPassthrough = _useState3[1];

    var fieldNames = inspection ? Object.keys(inspection.fields || {}) : [];
    var reviewStep = fieldNames.length + 1;
    var previewStep = fieldNames.length + 2;
    var totalSteps = fieldNames.length + 3; // intro + fields + review + preview

    useEffect(function () {
      if (open) {
        setStep(0);
        setAnswers([]);
        setPassthrough(false);
      }
    }, [open]);

    if (!open) return null;

    function acceptAllRemaining(fromIndex) {
      var newAnswers = answers.slice();
      for (var i = fromIndex; i < fieldNames.length; i++) {
        var fn = fieldNames[i];
        if (newAnswers.find(function (a) { return a.field === fn; })) continue;
        var inferred = JsonTransformer.inferFieldDefaults(inspection, fn);
        newAnswers.push({
          field: fn,
          action: "accept",
          source: fn,
          target: inferred.targetField,
          type: inferred.type,
          format: inferred.format,
        });
      }
      setAnswers(newAnswers);
      showToast("Defaults applied to remaining fields", "success", 2500);
    }

    function handleFieldAnswer(fieldName, answer) {
      var newAnswers = answers.slice();
      var existing = newAnswers.find(function (a) { return a.field === fieldName; });
      if (existing) {
        Object.assign(existing, answer);
      } else {
        newAnswers.push(Object.assign({ field: fieldName }, answer));
      }
      setAnswers(newAnswers);
    }

    function handleNext() {
      if (step >= 1 && step <= fieldNames.length) {
        var fn = fieldNames[step - 1];
        var ans = answers.find(function (a) { return a.field === fn; });
        if (!ans || ans.action !== "skip") {
          var inf = JsonTransformer.inferFieldDefaults(inspection, fn);
          if (!ans) {
            handleFieldAnswer(fn, {
              action: "accept",
              source: fn,
              target: inf.targetField,
              type: inf.type,
              format: inf.format,
            });
          } else if (!ans.target || !String(ans.target).trim()) {
            showToast("Enter a destination field name or skip this field", "warning");
            return;
          }
        }
      }
      if (step < previewStep) {
        setStep(step + 1);
      } else {
        var mapping = buildMappingFromAnswers(answers, passthrough);
        onComplete(mapping, passthrough);
        onClose();
      }
    }

    function handleBack() {
      setStep(Math.max(0, step - 1));
    }

    function buildMappingFromAnswers(ans, pt) {
      var fields = {};
      ans.forEach(function (a) {
        if (a.action === "skip") return;
        var target = a.target || JsonTransformer.toCamelCase(a.field.replace(/\./g, "_"));
        var fieldDef = { from: a.source || a.field };
        if (a.type && a.type !== "auto") fieldDef.type = a.type;
        if (a.format) fieldDef.format = a.format;
        if (a.default !== undefined) fieldDef.default = a.default;
        fields[target] = fieldDef;
      });
      var mapping = { fields: fields };
      if (pt) mapping.passthrough = true;
      return mapping;
    }

    // Render steps
    function renderStep() {
      if (step === 0) {
        // Intro
        return h("div", null,
          h("h3", { className: "mb-2" }, "Welcome to the Mapping Wizard"),
          h("p", { className: "mb-2" }, "This wizard will guide you through creating a mapping for your data."),
          h("p", { className: "mb-2" }, "You have " + inspection.recordCount + " records with " + fieldNames.length + " fields."),
          h("label", { className: "flex items-center gap-2" },
            h("input", {
              type: "checkbox",
              checked: passthrough,
              onChange: function (e) { setPassthrough(e.target.checked); },
            }),
            "Include unmapped source fields (passthrough)"
          )
        );
      } else if (step <= fieldNames.length) {
        // Field mapping
        var fieldName = fieldNames[step - 1];
        var fieldInfo = inspection.fields[fieldName];
        var currentAnswer = answers.find(function (a) { return a.field === fieldName; });
        var inferred = JsonTransformer.inferFieldDefaults(inspection, fieldName);
        var isSkipped = currentAnswer && currentAnswer.action === "skip";
        var destinationName = isSkipped
          ? ""
          : ((currentAnswer && currentAnswer.target) || inferred.targetField);

        function saveDestination(target) {
          handleFieldAnswer(fieldName, {
            action: "accept",
            source: fieldName,
            target: target || inferred.targetField,
            type: inferred.type,
            format: inferred.format,
          });
        }

        return h("div", null,
          h("h3", { className: "mb-2" }, "Field " + step + " of " + fieldNames.length),
          h("div", { className: "wizard-field-map" },
            h("div", { className: "wizard-field-map-row" },
              h("label", { className: "wizard-field-map-label" }, "Source"),
              h("div", { className: "wizard-source-field" }, fieldName)
            ),
            h("div", { className: "wizard-field-map-row" },
              h("label", { className: "wizard-field-map-label", for: "wizard-target-" + step }, "Destination"),
              h("input", {
                id: "wizard-target-" + step,
                className: "mapping-field-input wizard-destination-input",
                type: "text",
                value: destinationName,
                disabled: isSkipped,
                placeholder: "output_field_name",
                onInput: function (e) { saveDestination(e.target.value.trim()); },
              })
            ),
            h("div", { className: "text-sm text-muted" },
              "Type: " + (fieldInfo ? fieldInfo.type : "unknown") +
              (fieldInfo && fieldInfo.distinctValues ? " | Suggested: " + inferred.targetField : "")
            )
          ),
          h("div", { className: "wizard-options" },
            h("button", {
              type: "button",
              className: "wizard-option" + (!isSkipped && currentAnswer ? " selected" : ""),
              onClick: function () { saveDestination(inferred.targetField); },
            },
              h("span", null, "\u2705"),
              h("span", null, "Use suggested name: " + inferred.targetField)
            ),
            h("button", {
              type: "button",
              className: "wizard-option" + (isSkipped ? " selected" : ""),
              onClick: function () { handleFieldAnswer(fieldName, { action: "skip" }); },
            },
              h("span", null, "\u23E9"),
              h("span", null, "Skip this field")
            )
          ),
          !isSkipped ? h("p", { className: "text-sm text-muted mt-2" },
            "Edit the destination name above, or use the suggested name."
          ) : null,
          step - 1 < fieldNames.length - 1 ? h("button", {
            type: "button",
            className: "btn btn-sm btn-secondary mt-2",
            onClick: function () { acceptAllRemaining(step - 1); },
          }, "Apply defaults to all remaining fields") : null
        );
      } else if (step === reviewStep) {
        var mappingReview = buildMappingFromAnswers(answers, passthrough);
        return h("div", null,
          h("h3", { className: "mb-2" }, "Review Your Mapping"),
          h("pre", { className: "code-editor", style: { maxHeight: "280px", overflow: "auto" } },
            JSON.stringify(mappingReview, null, 2)
          )
        );
      } else if (step === previewStep) {
        var mappingPreview = buildMappingFromAnswers(answers, passthrough);
        var previewOut = null;
        var previewErr = null;
        if (data && mappingPreview.fields && Object.keys(mappingPreview.fields).length) {
          try {
            var slice = Array.isArray(data) ? data.slice(0, 5) : [data];
            previewOut = JsonTransformer.transform(slice, JsonTransformer.prepareMapping(mappingPreview));
          } catch (ex) {
            previewErr = ex.message;
          }
        }
        return h("div", null,
          h("h3", { className: "mb-2" }, "Preview Output"),
          h("p", { className: "text-sm text-muted mb-2" }, "Sample transform on first " + Math.min(5, (data && data.length) || 0) + " record(s)"),
          previewErr ? h("div", { className: "validation-error" }, previewErr)
            : h("pre", { className: "code-editor", style: { maxHeight: "280px", overflow: "auto" } },
                JSON.stringify(previewOut, null, 2)
              )
        );
      }
    }

    return h("div", { className: "modal-overlay", onClick: function (e) { if (e.target === e.currentTarget) onClose(); } },
      h("div", { className: "modal" },
        h("div", { className: "modal-header" },
          h("span", { className: "modal-title" }, "Mapping Wizard"),
          h("button", { className: "btn btn-icon", onClick: onClose }, "\u2715")
        ),
        h("div", { className: "wizard-progress" },
          Array.from({ length: totalSteps }).map(function (_, i) {
            return h("div", {
              key: i,
              className: "wizard-step-indicator" + (i === step ? " active" : "") + (i < step ? " completed" : ""),
            });
          })
        ),
        h("div", { className: "modal-body" }, renderStep()),
        h("div", { className: "modal-footer" },
          h("button", {
            className: "btn btn-secondary",
            onClick: function () { step === 0 ? onClose() : handleBack(); },
          },
            step === 0 ? "Cancel" : "Back"
          ),
          h("button", { className: "btn btn-primary", onClick: handleNext },
            step === previewStep ? "Finish" : "Next"
          )
        )
      )
    );
  }

  // ── Toast Container ────────────────────────────────────────────────

  function ToastContainer() {
    var toasts = useToasts();
    return h("div", { className: "toast-container" },
      toasts.map(function (toast) {
        return h("div", {
          key: toast.id,
          className: "toast toast-" + toast.type,
        },
          h("span", null, toast.message),
          h("button", {
            className: "btn btn-icon btn-sm",
            onClick: function () { removeToast(toast.id); },
          }, "\u2715")
        );
      })
    );
  }

  // ── Main App ───────────────────────────────────────────────────────

  function App() {
    // State
    var _useState = useState(null), sourceData = _useState[0], setSourceData = _useState[1];
    var _useState2 = useState(null), inspection = _useState2[0], setInspection = _useState2[1];
    var _useState3 = useState([]), mappingFields = _useState3[0], setMappingFields = _useState3[1];
    var _useState4 = useState("visual"), editorMode = _useState4[0], setEditorMode = _useState4[1];
    var _useState5 = useState(""), codeEditorValue = _useState5[0], setCodeEditorValue = _useState5[1];
    var _useState6 = useState(null), previewOutput = _useState6[0], setPreviewOutput = _useState6[1];
    var _useState7 = useState([]), previewErrors = _useState7[0], setPreviewErrors = _useState7[1];
    var _useState8 = useState(false), wizardOpen = _useState8[0], setWizardOpen = _useState8[1];
    var _useState9 = useState(getTheme()), theme = _useState9[0], setThemeState = _useState9[1];
    var _useState10 = useState(""), selectedPath = _useState10[0], setSelectedPath = _useState10[1];
    var _useState11 = useState(false), isLoading = _useState11[0], setIsLoading = _useState11[1];
    var _useState12 = useState(function () {
      return localStorage.getItem("jt-autosave-pref");
    }), autosavePref = _useState12[0], setAutosavePref = _useState12[1];
    var _useState13 = useState(false), passthrough = _useState13[0], setPassthrough = _useState13[1];
    var _useState13b = useState({}), mappingMeta = _useState13b[0], setMappingMeta = _useState13b[1];
    var _useState14 = useState(5), previewLimit = _useState14[0], setPreviewLimit = _useState14[1];
    var _useState15 = useState(null), expectedOutput = _useState15[0], setExpectedOutput = _useState15[1];
    var _useState16 = useState([]), mappingValidationErrors = _useState16[0], setMappingValidationErrors = _useState16[1];
    var _useState17 = useState({ source: false, mapping: false, preview: false }), collapsedPanels = _useState17[0], setCollapsedPanels = _useState17[1];
    var _useState18 = useState([]), undoStack = _useState18[0], setUndoStack = _useState18[1];
    var _useState19 = useState([]), redoStack = _useState19[0], setRedoStack = _useState19[1];
    var computeWarningAck = useRef(false);
    var skipVisualCodeSyncRef = useRef(false);
    var codeSnapshotRef = useRef(null);
    var fileInputRef = useRef(null);
    var expectedInputRef = useRef(null);
    var _useState20 = useState([]), importedFieldSummary = _useState20[0], setImportedFieldSummary = _useState20[1];

    var mappingFieldSummary = useMemo(function () {
      if (!MF) return [];
      try {
        if (editorMode === "visual" && mappingFields.length) {
          return mappingFields
            .filter(function (f) { return f.target; })
            .map(function (f) {
              return {
                target: f.target,
                kind: f.kind || "simple",
                label: f.kind === "advanced" ? "" : (f.source || f.forEachPath || ""),
              };
            });
        }
        if (editorMode !== "visual" && codeEditorValue.trim()) {
          return MF.fieldSummaryFromMapping(parseMappingFromCode(codeEditorValue, editorMode));
        }
      } catch (e) { /* invalid while typing */ }
      if (importedFieldSummary.length) return importedFieldSummary;
      return [];
    }, [editorMode, mappingFields, codeEditorValue, importedFieldSummary]);

    function applyCompanionSourceIfNeeded(meta) {
      var id = meta && meta.id;
      var companion = id && COMPANION_SOURCE_BY_MAPPING_ID[id];
      if (!companion) return false;
      if (sourceData && dataHasTopLevelField(sourceData, "EmployeeName")) return false;
      setSourceData(companion);
      setInspection(JsonTransformer.inspect(companion));
      return true;
    }

    function setMappingFieldsWithHistory(next) {
      setUndoStack(function (s) {
        return s.concat([JSON.stringify(mappingFields)]).slice(-50);
      });
      setRedoStack([]);
      setMappingFields(next);
    }

    function undoMapping() {
      if (!undoStack.length) return;
      var prev = undoStack[undoStack.length - 1];
      setUndoStack(function (s) { return s.slice(0, -1); });
      setRedoStack(function (s) { return s.concat([JSON.stringify(mappingFields)]); });
      setMappingFields(JSON.parse(prev));
      showToast("Undo", "info", 1500);
    }

    function redoMapping() {
      if (!redoStack.length) return;
      var next = redoStack[redoStack.length - 1];
      setRedoStack(function (s) { return s.slice(0, -1); });
      setUndoStack(function (s) { return s.concat([JSON.stringify(mappingFields)]); });
      setMappingFields(JSON.parse(next));
      showToast("Redo", "info", 1500);
    }

    function togglePanel(name) {
      setCollapsedPanels(function (c) {
        var n = Object.assign({}, c);
        n[name] = !n[name];
        return n;
      });
    }

    // Apply theme
    useEffect(function () {
      setTheme(theme);
    }, [theme]);

    // Load saved state from localStorage (only when auto-save is enabled)
    useEffect(function () {
      if (autosavePref !== "on") return;
      try {
        var saved = localStorage.getItem("jt-mapping");
        if (saved) {
          var parsed = JSON.parse(saved);
          if (parsed.fields) setMappingFields(parsed.fields);
          if (parsed.passthrough) setPassthrough(MF ? MF.passthroughToBool(parsed.passthrough) : true);
          if (parsed.mappingMeta) setMappingMeta(parsed.mappingMeta);
          if (parsed.code) {
            setCodeEditorValue(parsed.code);
            if (parsed.mode) setEditorMode(parsed.mode);
          }
        }
      } catch (e) { }
    }, [autosavePref]);

    // Save mapping to localStorage when opted in
    useEffect(function () {
      if (autosavePref !== "on") return;
      if (mappingFields.length > 0 || codeEditorValue) {
        var state = {
          fields: mappingFields,
          code: codeEditorValue,
          mode: editorMode,
          passthrough: passthrough,
          mappingMeta: mappingMeta,
        };
        localStorage.setItem("jt-mapping", JSON.stringify(state));
      }
    }, [mappingFields, codeEditorValue, editorMode, autosavePref, passthrough, mappingMeta]);

    useEffect(function () {
      if (editorMode === "visual" && sourceData && MF) {
        setMappingValidationErrors(MF.validateVisualFields(mappingFields, sourceData));
      } else {
        setMappingValidationErrors([]);
      }
    }, [mappingFields, sourceData, editorMode]);

    // Run transform when data or mapping changes (debounced)
    useEffect(function () {
      if (!sourceData) {
        setPreviewOutput(null);
        setPreviewErrors([]);
        return;
      }

      var timer = setTimeout(function () {
        try {
          var mapping = resolveActiveMapping(
            editorMode,
            mappingFields,
            codeEditorValue,
            passthrough,
            mappingMeta,
            codeSnapshotRef.current
          );

          if (!mapping || !mapping.fields) {
            setPreviewOutput(null);
            setPreviewErrors([]);
            return;
          }

          if (mappingHasCompute(mapping) && !computeWarningAck.current) {
            var ok = window.confirm(
              "This mapping includes compute functions that run JavaScript on your data. " +
              "Only continue if you trust this mapping. Continue?"
            );
            if (!ok) {
              setPreviewOutput(null);
              setPreviewErrors([{ message: "Preview blocked: compute functions require confirmation" }]);
              return;
            }
            computeWarningAck.current = true;
          }

          var ready = JsonTransformer.prepareMapping(mapping);

          if (ready.schema) {
            var validation = JsonTransformer.validate(sourceData, ready);
            setPreviewErrors(validation.errors || []);
          } else {
            setPreviewErrors([]);
          }

          var previewData = Array.isArray(sourceData)
            ? sourceData.slice(0, previewLimit)
            : sourceData;
          var result = JsonTransformer.transform(previewData, ready);
          setPreviewOutput(result);
        } catch (e) {
          setPreviewOutput(null);
          setPreviewErrors([{ message: "Transform error: " + e.message }]);
        }
      }, 200);

      return function () { clearTimeout(timer); };
    }, [sourceData, mappingFields, codeEditorValue, editorMode, passthrough, previewLimit, mappingMeta]);

    // File loading
    function handleFileLoad(e) {
      var file = e.target.files[0];
      if (!file) return;
      setIsLoading(true);
      var reader = new FileReader();
      reader.onload = function (ev) {
        try {
          var data = JSON.parse(ev.target.result);
          // Ensure data is an array
          if (!Array.isArray(data)) {
            data = [data];
          }
          setSourceData(data);
          var insp = JsonTransformer.inspect(data);
          setInspection(insp);
          showToast("Loaded " + insp.recordCount + " records with " + Object.keys(insp.fields).length + " fields", "success");
        } catch (err) {
          showToast("Failed to parse JSON: " + err.message, "error");
        } finally {
          setIsLoading(false);
          e.target.value = "";
        }
      };
      reader.onerror = function () {
        showToast("Failed to read file", "error");
        setIsLoading(false);
        e.target.value = "";
      };
      reader.readAsText(file);
    }

    function loadSample(index) {
      var sample = SAMPLE_DATASETS[index];
      if (!sample) return;
      setSourceData(sample.data);
      var insp = JsonTransformer.inspect(sample.data);
      setInspection(insp);
      showToast("Loaded sample: " + sample.name, "success");
    }

    // Export
    function exportMapping() {
      var mapping;
      try {
        mapping = resolveActiveMapping(
          editorMode,
          mappingFields,
          codeEditorValue,
          passthrough,
          mappingMeta,
          codeSnapshotRef.current
        );
      } catch (e) {
        showToast("Cannot export: invalid mapping (" + e.message + ")", "error");
        return;
      }
      if (!mapping || !mapping.fields || Object.keys(mapping.fields).length === 0) {
        showToast("No mapping to export", "warning");
        return;
      }
      var useJs = editorMode === "js" || mappingHasCompute(mapping);
      var content;
      var filename;
      var mimeType;
      if (useJs) {
        content = MF.formatMappingAsModule(mapping, true);
        if (MF.mappingHasCompute(mapping)) {
          showToast("Exported as JS module (compute functions serialized as JSON)", "info", 4500);
        }
        filename = "mapping.js";
        mimeType = "text/javascript";
      } else {
        content = JSON.stringify(mapping, null, 2);
        filename = "mapping.json";
        mimeType = "application/json";
      }
      downloadFile(content, filename, mimeType);
      showToast("Mapping exported as " + filename, "success");
    }

    function exportOutput() {
      if (!previewOutput) {
        showToast("No output to export", "warning");
        return;
      }
      var content = JSON.stringify(previewOutput, null, 2);
      downloadFile(content, "output.json", "application/json");
      showToast("Output exported", "success");
    }

    // Import mapping (.json / .js from json-transformer CLI)
    function handleMappingImport(e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        try {
          if (!MF) throw new Error("mapping-features.js not loaded");
          var result = parseImportedMapping(ev.target.result, file.name);
          skipVisualCodeSyncRef.current = true;
          codeSnapshotRef.current = {
            text: result.codeEditorValue,
            mode: result.editorMode === "js" ? "js" : "json",
            mapping: result.mapping,
          };
          setMappingMeta(result.meta);
          setPassthrough(result.passthrough);
          setEditorMode(result.editorMode);
          setCodeEditorValue(result.codeEditorValue);
          setMappingFields(result.mappingFields);
          setImportedFieldSummary(result.fieldSummary || []);
          computeWarningAck.current = false;
          if (applyCompanionSourceIfNeeded(result.meta)) {
            showToast(result.toast.message + " — loaded matching demo employee data for preview.", result.toast.type, 7000);
          } else if (result.meta.id === "employee-import" && sourceData && !dataHasTopLevelField(sourceData, "EmployeeName")) {
            showToast(result.toast.message + " — load Sample Data → Employee conditions (CLI demo) for full preview.", "warning", 8000);
          } else {
            showToast(result.toast.message, result.toast.type, result.toast.duration);
          }
        } catch (err) {
          showToast("Failed to import mapping: " + err.message, "error");
        }
        e.target.value = "";
      };
      reader.readAsText(file);
    }

    function loadSampleMapping(catalogId) {
      if (!SM || !MF) {
        showToast("Sample mappings require HTTP server (see README)", "warning", 5000);
        return;
      }
      var entry = SM.getById(catalogId);
      if (!entry) return;
      SM.loadPair(entry).then(function (pair) {
        var data = JSON.parse(pair.dataText);
        if (!Array.isArray(data)) data = [data];
        setSourceData(data);
        setInspection(JsonTransformer.inspect(data));
        var result = parseImportedMapping(pair.mappingText, pair.mapping);
        skipVisualCodeSyncRef.current = true;
        codeSnapshotRef.current = {
          text: result.codeEditorValue,
          mode: result.editorMode === "js" ? "js" : "json",
          mapping: result.mapping,
        };
        setMappingMeta(result.meta);
        setPassthrough(result.passthrough);
        setEditorMode(result.editorMode);
        setCodeEditorValue(result.codeEditorValue);
        setMappingFields(result.mappingFields);
        setImportedFieldSummary(result.fieldSummary || []);
        computeWarningAck.current = false;
        showToast(entry.name + " loaded", "success");
      }).catch(function (err) {
        showToast("Could not load sample (use a local server): " + err.message, "warning", 6000);
      });
    }

    // Sync code editor with visual fields when switching modes
    function switchMode(mode) {
      if (mode === editorMode) return;

      if (mode === "visual" && editorMode !== "visual") {
        try {
          if (!codeEditorValue.trim()) {
            setEditorMode(mode);
            return;
          }
          var parsed = parseMappingFromCode(codeEditorValue, editorMode);
          codeSnapshotRef.current = {
            text: codeEditorValue,
            mode: editorMode,
            mapping: parsed,
          };
          skipVisualCodeSyncRef.current = true;
          setMappingFields(visualFieldsFromMapping(parsed));
          setImportedFieldSummary([]);
          setEditorMode(mode);
          return;
        } catch (e) {
          showToast("Cannot convert to visual mode: " + e.message, "error");
          return;
        }
      }

      if (mode !== "visual" && editorMode === "visual") {
        var snap = codeSnapshotRef.current;
        if (snap && snap.mapping) {
          var merged = MF.mergeVisualFieldsIntoMapping(mappingFields, snap.mapping, {
            passthrough: passthrough === true,
            meta: mappingMeta,
          });
          skipVisualCodeSyncRef.current = true;
          var hasFnCompute = MF.mappingHasCompute(merged);
          var nextText;

          if (mode === "json") {
            nextText = JSON.stringify(merged, null, 2);
            setCodeEditorValue(nextText);
          } else if (hasFnCompute && snap.mode === "js") {
            nextText = snap.text;
            setCodeEditorValue(nextText);
            showToast(
              "JS source preserved (compute functions). Preview and export use merged mapping.",
              "info",
              5500
            );
          } else {
            nextText = MF.formatMappingAsModule(merged, true);
            setCodeEditorValue(nextText);
          }

          codeSnapshotRef.current = {
            text: nextText,
            mode: mode,
            mapping: merged,
          };
        } else if (mappingFields.length > 0) {
          var built = buildMappingFromVisual(mappingFields, passthrough, mappingMeta);
          skipVisualCodeSyncRef.current = true;
          var builtText = mode === "json"
            ? JSON.stringify(built, null, 2)
            : MF.formatMappingAsModule(built, true);
          setCodeEditorValue(builtText);
          codeSnapshotRef.current = { text: builtText, mode: mode, mapping: built };
        }
        setEditorMode(mode);
        return;
      }

      if (mode === "json" && editorMode === "js") {
        try {
          var fromJs = MF.applyMappingMeta(MF.parseMappingModule(codeEditorValue), mappingMeta);
          skipVisualCodeSyncRef.current = true;
          var jsonText = JSON.stringify(fromJs, null, 2);
          setCodeEditorValue(jsonText);
          codeSnapshotRef.current = { text: jsonText, mode: "json", mapping: fromJs };
        } catch (e) {
          showToast("Invalid JS mapping: " + e.message, "error");
          return;
        }
      } else if (mode === "js" && editorMode === "json") {
        try {
          var fromJson = MF.applyMappingMeta(JSON.parse(codeEditorValue), mappingMeta);
          skipVisualCodeSyncRef.current = true;
          var jsText = MF.formatMappingAsModule(fromJson, true);
          setCodeEditorValue(jsText);
          codeSnapshotRef.current = { text: jsText, mode: "js", mapping: fromJson };
        } catch (e) {
          showToast("Invalid JSON mapping: " + e.message, "error");
          return;
        }
      }

      setEditorMode(mode);
    }

    function handleCodeEditorChange(text) {
      setCodeEditorValue(text);
      setImportedFieldSummary([]);
      if (editorMode === "visual" || !MF) return;
      try {
        var parsed = parseMappingFromCode(text, editorMode);
        codeSnapshotRef.current = {
          text: text,
          mode: editorMode,
          mapping: parsed,
        };
      } catch (e) { /* ignore while typing invalid code */ }
    }

    // Tree node selection — copy dot-path to clipboard (FR-102)
    function handleTreeSelect(path) {
      if (!path) return;
      setSelectedPath(path);
      copyToClipboard(path);
    }

    function clearSavedData() {
      localStorage.removeItem("jt-mapping");
      showToast("Saved draft cleared", "success", 2000);
    }

    function setAutosavePreference(enabled) {
      var pref = enabled ? "on" : "off";
      localStorage.setItem("jt-autosave-pref", pref);
      setAutosavePref(pref);
      if (!enabled) {
        localStorage.removeItem("jt-mapping");
      }
      showToast(enabled ? "Auto-save enabled" : "Auto-save disabled", "info", 2500);
    }

    // Wizard complete
    function handleWizardComplete(mapping, wizardPassthrough) {
      var fields = visualFieldsFromMapping(mapping);
      setMappingFieldsWithHistory(fields);
      setMappingMeta(MF ? MF.extractMappingMeta(mapping) : {});
      setPassthrough(!!wizardPassthrough);
      setEditorMode("visual");
      showToast("Wizard complete! " + fields.length + " fields mapped.", "success");
    }

    function handleLoadExpected(e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        try {
          var data = JSON.parse(ev.target.result);
          if (!Array.isArray(data)) data = [data];
          setExpectedOutput(data);
          showToast("Loaded expected output (" + data.length + " records)", "success");
        } catch (err) {
          showToast("Invalid expected output JSON", "error");
        }
        e.target.value = "";
      };
      reader.readAsText(file);
    }

    function triggerExpectedLoad() {
      if (!expectedInputRef.current) {
        var input = document.createElement("input");
        input.type = "file";
        input.accept = ".json,application/json";
        input.onchange = handleLoadExpected;
        input.click();
        return;
      }
      expectedInputRef.current.click();
    }

    function clearPreview() {
      setPreviewOutput(null);
      setPreviewErrors([]);
      showToast("Preview cleared", "info", 1500);
    }

    // Reset workspace — clear loaded data and mapping
    function clearData() {
      setSourceData(null);
      setInspection(null);
      setMappingFields([]);
      setCodeEditorValue("");
      setEditorMode("visual");
      setPreviewOutput(null);
      setPreviewErrors([]);
      setExpectedOutput(null);
      setPassthrough(false);
      setMappingMeta({});
      setImportedFieldSummary([]);
      setMappingValidationErrors([]);
      setUndoStack([]);
      setRedoStack([]);
      setSelectedPath("");
      setWizardOpen(false);
      computeWarningAck.current = false;
      codeSnapshotRef.current = null;
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (expectedInputRef.current) expectedInputRef.current.value = "";
      if (autosavePref === "on") {
        localStorage.removeItem("jt-mapping");
      }
      showToast("Data and mapping reset", "success", 2000);
    }

    // Sync code editor from visual fields only while in visual mode (never clobber JS/JSON imports)
    useEffect(function () {
      if (skipVisualCodeSyncRef.current) {
        skipVisualCodeSyncRef.current = false;
        return;
      }
      if (editorMode !== "visual" || mappingFields.length === 0) return;
      var mapping = buildMappingFromVisual(mappingFields, passthrough, mappingMeta);
      setCodeEditorValue(JSON.stringify(mapping, null, 2));
      setImportedFieldSummary([]);
    }, [editorMode, mappingFields, passthrough, mappingMeta]);

    return h("div", { className: "app-shell" },
      autosavePref === null ? h("div", { className: "autosave-banner" },
        h("span", null, "Auto-save your work to browser storage? (data stays on this device)"),
        h("div", { className: "flex gap-1" },
          h("button", { className: "btn btn-sm btn-primary", onClick: function () { setAutosavePreference(true); } }, "Enable"),
          h("button", { className: "btn btn-sm btn-secondary", onClick: function () { setAutosavePreference(false); } }, "No thanks")
        )
      ) : null,
      // Header
      h("header", { className: "app-header" },
        h("div", { className: "app-title" },
          h("span", { className: "logo" }, "\uD83D\uDD04"),
          "json-transformer Assistant"
        ),
        h("div", { className: "header-actions" },
          // Data loading
          h("button", {
            className: "btn btn-secondary",
            onClick: function () { return fileInputRef.current.click(); },
          }, "\uD83D\uDCC4 Load Data"),
          h("input", {
            ref: fileInputRef,
            type: "file",
            accept: ".json,application/json",
            style: { display: "none" },
            onChange: handleFileLoad,
          }),
          // Sample data dropdown
          h("select", {
            className: "btn btn-secondary",
            onChange: function (e) { if (e.target.value) loadSample(parseInt(e.target.value, 10)); e.target.value = ""; },
          },
            h("option", { value: "" }, "Sample Data..."),
            SAMPLE_DATASETS.map(function (s, i) { return h("option", { key: i, value: i }, s.name); })
          ),
          SM ? h("select", {
            className: "btn btn-secondary",
            title: "Load json-transformer sample mapping + data",
            onChange: function (e) { if (e.target.value) loadSampleMapping(e.target.value); e.target.value = ""; },
          },
            h("option", { value: "" }, "CLI Samples..."),
            SM.CATALOG.map(function (s) { return h("option", { key: s.id, value: s.id }, s.name); })
          ) : null,
          h("button", {
            className: "btn btn-secondary",
            onClick: function () { setWizardOpen(true); },
            disabled: !inspection,
          }, "\uD83D\uDD74 Wizard"),
          // Mapping import
          h("button", {
            className: "btn btn-secondary",
            onClick: function () {
              var input = document.createElement("input");
              input.type = "file";
              input.accept = ".json,.js";
              input.onchange = handleMappingImport;
              input.click();
            },
          }, "\uD83D\uDCE5 Import"),
          // Export
          h("button", { className: "btn btn-primary", onClick: exportMapping }, "\uD83D\uDCE4 Export"),
          h("button", {
            className: "btn btn-secondary",
            onClick: exportOutput,
            disabled: !previewOutput,
          }, "\uD83D\uDCE4 Output"),
          h("button", {
            className: "btn btn-secondary",
            onClick: clearData,
            "data-tooltip": "Reset — clear data, mapping, and preview",
          }, "\u2716 Reset"),
          autosavePref === "on" ? h("button", {
            className: "btn btn-secondary",
            onClick: clearSavedData,
            "data-tooltip": "Clear auto-saved draft",
          }, "Clear draft") : null,
          // Theme toggle
          h("button", {
            className: "btn btn-icon btn-secondary",
            onClick: function () { setThemeState(theme === "light" ? "dark" : "light"); },
            "data-tooltip": "Toggle theme",
          }, theme === "light" ? "\u2600" : "\uD83C\uDF19")
        )
      ),
      h("input", {
        ref: expectedInputRef,
        type: "file",
        accept: ".json,application/json",
        style: { display: "none" },
        onChange: handleLoadExpected,
      }),
      // Main content
      h("main", { className: "app-main" },
        h(SourceTreePanel, {
          data: sourceData,
          onSelect: handleTreeSelect,
          selectedPath: selectedPath,
          collapsed: collapsedPanels.source,
          onToggleCollapse: function () { togglePanel("source"); },
        }),
        h("div", { className: "panel panel-mapping" + (collapsedPanels.mapping ? " panel-collapsed" : "") },
          h("div", { className: "panel-header" },
            h("span", { className: "panel-title" }, collapsedPanels.mapping ? "Map" : "Mapping Editor"),
            h("div", { className: "flex gap-1 flex-wrap" },
              collapsedPanels.mapping ? null : [
                h("button", { type: "button", className: "btn btn-sm btn-secondary", onClick: undoMapping, disabled: !undoStack.length, title: "Undo" }, "Undo"),
                h("button", { type: "button", className: "btn btn-sm btn-secondary", onClick: redoMapping, disabled: !redoStack.length, title: "Redo" }, "Redo"),
                ["visual", "json", "js"].map(function (mode) {
                  return h("button", {
                    key: mode,
                    type: "button",
                    className: "btn btn-sm " + (editorMode === mode ? "btn-primary" : "btn-secondary"),
                    onClick: function () { switchMode(mode); },
                  }, mode === "visual" ? "Visual" : mode.toUpperCase());
                }),
              ],
              h("button", { type: "button", className: "btn btn-sm btn-secondary", onClick: function () { togglePanel("mapping"); } }, collapsedPanels.mapping ? "\u25B6" : "\u25C0")
            )
          ),
          collapsedPanels.mapping ? null : h("div", { className: "panel-body panel-body-mapping" },
            isLoading ? h("div", { className: "loading-spinner" }, "Processing...") : null,
            h(DataInspector, { inspection: inspection }),
            h("div", { className: "mapping-editor-scroll" },
              editorMode === "visual"
                ? h(VisualMappingEditor, {
                    fields: mappingFields,
                    onChange: setMappingFieldsWithHistory,
                    inspection: inspection,
                    passthrough: passthrough,
                    onPassthroughChange: setPassthrough,
                    sourceData: sourceData,
                    validationErrors: mappingValidationErrors,
                  })
                : h(CodeEditor, {
                    key: editorMode,
                    mode: editorMode,
                    value: codeEditorValue,
                    onChange: handleCodeEditorChange,
                    fieldSummary: mappingFieldSummary,
                  })
            )
          )
        ),
        h(PreviewPanel, {
          output: previewOutput,
          errors: previewErrors,
          expectedOutput: expectedOutput,
          previewLimit: previewLimit,
          onPreviewLimitChange: setPreviewLimit,
          onClearPreview: clearPreview,
          onLoadExpected: triggerExpectedLoad,
          collapsed: collapsedPanels.preview,
          onToggleCollapse: function () { togglePanel("preview"); },
        })
      ),
      // Wizard modal
      h(WizardModal, {
        open: wizardOpen,
        onClose: function () { setWizardOpen(false); },
        data: sourceData,
        inspection: inspection,
        onComplete: handleWizardComplete,
      }),
      // Toasts
      h(ToastContainer, null)
    );
  }

  // ── Mount ──────────────────────────────────────────────────────────

  setTheme(getTheme());
  preact.render(h(App, null), document.getElementById("app"));

})();
