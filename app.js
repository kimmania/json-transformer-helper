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

  // ── Sample datasets (bundled) ──────────────────────────────────────

  var SAMPLE_EMPLOYEES = [
    { id: "E001", fullName: "Alice Johnson", department: "Engineering", role: "Senior Developer", salary: 95000, hireDate: "2020-03-15", active: true, address: { city: "San Francisco", state: "CA", zip: "94102" } },
    { id: "E002", fullName: "Bob Smith", department: "Marketing", role: "Marketing Manager", salary: 82000, hireDate: "2019-07-22", active: true, address: { city: "New York", state: "NY", zip: "10001" } },
    { id: "E003", fullName: "Carol Davis", department: "Engineering", role: "Junior Developer", salary: 65000, hireDate: "2023-01-10", active: true, address: { city: "Austin", state: "TX", zip: "73301" } },
  ];

  var SAMPLE_ORDERS = [
    { orderId: "ORD-1001", customerName: "Acme Corp", items: [{ sku: "WIDGET-A", qty: 5, price: 29.99 }, { sku: "WIDGET-B", qty: 2, price: 49.99 }], status: "shipped", orderDate: "2024-11-15" },
    { orderId: "ORD-1002", customerName: "Globex Inc", items: [{ sku: "GADGET-X", qty: 1, price: 199.99 }], status: "pending", orderDate: "2024-11-18" },
  ];

  var SAMPLE_DATASETS = [
    { name: "Employees (nested objects)", data: SAMPLE_EMPLOYEES },
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
    if (!obj || typeof obj !== "object") return false;
    if (typeof obj.compute === "function") return true;
    for (var k in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, k) && mappingHasCompute(obj[k])) {
        return true;
      }
    }
    return false;
  }

  function parseMappingFromCode(text, mode) {
    if (!text || !String(text).trim()) return null;
    if (mode === "json") {
      return JSON.parse(text);
    }
    return new Function("return " + text)();
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
    var visualFields = [];
    if (!mapping || !mapping.fields) return visualFields;
    Object.entries(mapping.fields).forEach(function (_a) {
      var target = _a[0], def = _a[1];
      visualFields.push({
        target: target,
        source: def.from || "",
        type: def.type || "auto",
        format: def.format || "",
        default: def.default != null ? String(def.default) : "",
      });
    });
    return visualFields;
  }

  // ── Tree Node Component ────────────────────────────────────────────

  function TreeNode(props) {
    var nodeKey = props.nodeKey;
    var value = props.value;
    var path = props.path;
    var onSelect = props.onSelect;
    var selectedPath = props.selectedPath;
    var searchQuery = props.searchQuery;
    var depth = props.depth || 0;

    var _useState = useState(depth > 0 || !!searchQuery), expanded = _useState[0], setExpanded = _useState[1];

    useEffect(function () {
      if (searchQuery) setExpanded(true);
    }, [searchQuery]);

    if (searchQuery && !treeHasMatchingDescendant(value, path, searchQuery)) {
      return null;
    }

    var type = getType(value);
    var isExpandable = type === "object" || type === "array";
    var isSelected = path === selectedPath;

    function handleClick() {
      if (isExpandable) {
        setExpanded(function (e) { return !e; });
      }
      if (onSelect) {
        onSelect(path, value, type);
      }
    }

    function renderValue() {
      if (type === "null") return h("span", { className: "tree-value", style: { color: "var(--type-null)" } }, "null");
      if (type === "boolean") return h("span", { className: "tree-value", style: { color: "var(--type-boolean)" } }, String(value));
      if (type === "number") return h("span", { className: "tree-value", style: { color: "var(--type-number)" } }, String(value));
      if (type === "string") return h("span", { className: "tree-value", style: { color: "var(--type-string)" } }, truncate(value, 30));
      if (type === "array") return h("span", { className: "tree-value" }, "[" + value.length + "]");
      if (type === "object") {
        var keys = Object.keys(value);
        return h("span", { className: "tree-value" }, "{" + keys.length + "}");
      }
      return null;
    }

    var children = [
      h("div", {
        className: "tree-node-content" + (isSelected ? " selected" : ""),
        onClick: handleClick,
        style: { paddingLeft: (depth * 12) + "px" },
      },
        isExpandable ? h("span", { className: "tree-toggle" }, expanded ? "\u25BC" : "\u25B6") : h("span", { className: "tree-toggle" }),
        nodeKey ? h("span", { className: "tree-key" }, nodeKey) : null,
        h("span", { className: "tree-type " + type }, type),
        renderValue()
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
    var _useState = useState(""), searchQuery = _useState[0], setSearchQuery = _useState[1];
    var selectedPath = props.selectedPath;

    var filteredData = data;

    if (!data) {
      return h("div", null,
        h("div", { className: "panel" },
          h("div", { className: "panel-header" },
            h("span", { className: "panel-title" }, "Source Data")
          ),
          h("div", { className: "panel-body" },
            h("div", { className: "empty-state" },
              h("div", { className: "empty-state-icon" }, "\uD83D\uDCC4"),
              h("div", { className: "empty-state-text" }, "No data loaded"),
              h("div", { className: "empty-state-text" }, "Load a JSON file or use sample data")
            )
          )
        )
      );
    }

    return h("div", { className: "panel panel-source" },
      h("div", { className: "panel-header" },
        h("span", { className: "panel-title" }, "Source Data"),
        h("span", { className: "text-sm text-muted" }, Array.isArray(data) ? data.length + " records" : "1 object")
      ),
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
            path: null,
            onSelect: onSelect,
            selectedPath: selectedPath,
            searchQuery: searchQuery,
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
          depth: 0,
        })
      )
    );
  }

  // ── Mapping Editor (Table-based) ───────────────────────────────────

  function MappingFieldRow(props) {
    var field = props.field;
    var index = props.index;
    var onChange = props.onChange;
    var onRemove = props.onRemove;
    var onMove = props.onMove;
    var inspectionFields = props.inspectionFields || [];

    function update(key, value) {
      var updated = Object.assign({}, field, {});
      updated[key] = value;
      onChange(index, updated);
    }

    return h("div", { className: "mapping-field-row" },
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
      h("div", null,
        h("label", { className: "mapping-field-label" }, "Source Path"),
        h("input", {
          className: "mapping-field-input",
          type: "text",
          value: field.source || "",
          placeholder: "source.field.path",
          onInput: function (e) { update("source", e.target.value); },
          list: "field-suggestions",
        })
      ),
      h("div", { className: "mapping-field-actions" },
        h("button", {
          type: "button",
          className: "btn btn-sm btn-secondary",
          onClick: function () { onMove(index, -1); },
          disabled: index === 0,
          "data-tooltip": "Move up",
        }, "\u25B2"),
        h("button", {
          type: "button",
          className: "btn btn-sm btn-secondary",
          onClick: function () { onMove(index, 1); },
          disabled: index === (props.totalFields - 1),
          "data-tooltip": "Move down",
        }, "\u25BC"),
        h("button", {
          type: "button",
          className: "btn btn-sm btn-danger",
          onClick: function () { onRemove(index); },
          "data-tooltip": "Remove",
        }, "\u2715")
      ),
      h("div", { className: "mapping-field-options" },
        h("div", null,
          h("label", { className: "mapping-field-label" }, "Type"),
          h("select", {
            value: field.type || "auto",
            onChange: function (e) { update("type", e.target.value); },
          },
            h("option", { value: "auto" }, "Auto-detect"),
            h("option", { value: "string" }, "String"),
            h("option", { value: "number" }, "Number"),
            h("option", { value: "boolean" }, "Boolean"),
            h("option", { value: "date" }, "Date"),
            h("option", { value: "object" }, "Object"),
            h("option", { value: "array" }, "Array")
          )
        ),
        h("div", null,
          h("label", { className: "mapping-field-label" }, "Format"),
          h("select", {
            value: field.format || "",
            onChange: function (e) { update("format", e.target.value); },
          },
            h("option", { value: "" }, "None"),
            h("option", { value: "uppercase" }, "Uppercase"),
            h("option", { value: "lowercase" }, "Lowercase"),
            h("option", { value: "titlecase" }, "Title Case"),
            h("option", { value: "trim" }, "Trim"),
            h("option", { value: "number" }, "Number"),
            h("option", { value: "date" }, "Date")
          )
        ),
        h("div", null,
          h("label", { className: "mapping-field-label" }, "Default"),
          h("input", {
            className: "mapping-field-input",
            type: "text",
            value: field.default || "",
            placeholder: "fallback value",
            onInput: function (e) { update("default", e.target.value); },
          })
        )
      )
    );
  }

  function VisualMappingEditor(props) {
    var fields = props.fields;
    var onChange = props.onChange;
    var inspection = props.inspection;

    function addField() {
      var newFields = fields.slice();
      newFields.push({
        target: "new_field_" + (newFields.length + 1),
        source: "",
        type: "auto",
        format: "",
        default: "",
      });
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

    return h("div", { className: "mapping-editor" },
      h("div", { className: "flex justify-between items-center mb-2" },
        h("span", { className: "font-bold text-sm" }, "Field Mappings"),
        h("button", { className: "btn btn-sm btn-primary", onClick: addField }, "+ Add Field")
      ),
      fields.length === 0 ? h("div", { className: "empty-state" },
        h("div", { className: "empty-state-icon" }, "\uD83D\uDC64"),
        h("div", { className: "empty-state-text" }, "No fields mapped yet"),
        h("div", { className: "empty-state-text" }, "Click \"+ Add Field\" to start mapping")
      ) : fields.map(function (field, i) {
        return h(MappingFieldRow, {
          key: i,
          field: field,
          index: i,
          onChange: updateField,
          onRemove: removeField,
          onMove: moveField,
          totalFields: fields.length,
          inspectionFields: inspection ? Object.keys(inspection.fields || {}) : [],
        });
      }),
      // Hidden datalist for field suggestions
      h("datalist", { id: "field-suggestions" },
        (inspection ? Object.keys(inspection.fields || {}) : []).map(function (f) {
          return h("option", { key: f, value: f });
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

    function handleInput(e) {
      var text = e.target.value;
      onChange(text);
      // Validate
      if (mode === "json") {
        try {
          JSON.parse(text);
          setError("");
        } catch (e) {
          setError(e.message);
        }
      } else {
        try {
          new Function("return " + text);
          setError("");
        } catch (e) {
          setError(e.message);
        }
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

    return h("div", null,
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
    var _useState = useState(0), recordIndex = _useState[0], setRecordIndex = _useState[1];

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

    return h("div", { className: "panel panel-preview" },
      h("div", { className: "panel-header" },
        h("span", { className: "panel-title" }, "Preview"),
        errors && errors.length > 0
          ? h("span", { className: "text-sm", style: { color: "var(--danger)" } }, errors.length + " errors")
          : h("span", { className: "text-sm text-muted" }, totalRecords + " record" + (totalRecords !== 1 ? "s" : ""))
      ),
      Array.isArray(output) && output.length > 1 ? h("div", { className: "preview-record-nav" },
        h("button", {
          type: "button",
          className: "btn btn-sm btn-secondary",
          onClick: function () { setRecordIndex(function (i) { return Math.max(0, i - 1); }); },
          disabled: recordIndex === 0,
        }, "\u25C0"),
        h("span", { className: "preview-record-count" }, "Record " + (recordIndex + 1) + " / " + output.length),
        h("button", {
          type: "button",
          className: "btn btn-sm btn-secondary",
          onClick: function () { setRecordIndex(function (i) { return Math.min(output.length - 1, i + 1); }); },
          disabled: recordIndex >= output.length - 1,
        }, "\u25B6")
      ) : null,
      h("div", { className: "panel-body" },
        output ? h("pre", { className: "preview-output" }, JSON.stringify(getDisplayRecord(), null, 2))
          : h("div", { className: "empty-state" },
              h("div", { className: "empty-state-icon" }, "\uD83D\uDCC1"),
              h("div", { className: "empty-state-text" }, "No output yet"),
              h("div", { className: "empty-state-text" }, "Load data and create a mapping to see results")
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
    var totalSteps = fieldNames.length + 2; // intro + fields + review

    useEffect(function () {
      if (open) {
        setStep(0);
        setAnswers([]);
        setPassthrough(false);
      }
    }, [open]);

    if (!open) return null;

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
      if (step < fieldNames.length) {
        setStep(step + 1);
      } else if (step === fieldNames.length) {
        // Review step
        setStep(step + 1);
      } else {
        // Complete
        var mapping = buildMappingFromAnswers(answers, passthrough);
        onComplete(mapping);
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

        return h("div", null,
          h("h3", { className: "mb-2" }, "Field " + step + " of " + fieldNames.length),
          h("div", { className: "wizard-source-field" }, fieldName),
          h("div", { className: "text-sm text-muted mb-2" },
            "Type: " + (fieldInfo ? fieldInfo.type : "unknown") +
            (fieldInfo && fieldInfo.distinctValues ? " | Distinct: " + fieldInfo.distinctValues.length : "")
          ),
          h("div", { className: "wizard-options" },
            h("button", {
              type: "button",
              className: "wizard-option" + (currentAnswer && currentAnswer.action === "accept" ? " selected" : ""),
              onClick: function () { handleFieldAnswer(fieldName, { action: "accept", source: fieldName, target: inferred.targetField, type: inferred.type, format: inferred.format }); },
            },
              h("span", null, "\u2705"),
              h("span", null, "Accept default: " + fieldName + " \u2192 " + inferred.targetField + " (" + inferred.type + ")")
            ),
            h("button", {
              type: "button",
              className: "wizard-option" + (currentAnswer && currentAnswer.action === "skip" ? " selected" : ""),
              onClick: function () { handleFieldAnswer(fieldName, { action: "skip" }); },
            },
              h("span", null, "\u23E9"),
              h("span", null, "Skip this field")
            )
          )
        );
      } else if (step === fieldNames.length + 1) {
        // Review
        var mapping = buildMappingFromAnswers(answers, passthrough);
        return h("div", null,
          h("h3", { className: "mb-2" }, "Review Your Mapping"),
          h("pre", { className: "code-editor", style: { maxHeight: "300px", overflow: "auto" } },
            JSON.stringify(mapping, null, 2)
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
            step === fieldNames.length + 1 ? "Finish" : "Next"
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
    var computeWarningAck = useRef(false);
    var fileInputRef = useRef(null);

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
        };
        localStorage.setItem("jt-mapping", JSON.stringify(state));
      }
    }, [mappingFields, codeEditorValue, editorMode, autosavePref]);

    // Run transform when data or mapping changes (debounced)
    useEffect(function () {
      if (!sourceData) {
        setPreviewOutput(null);
        setPreviewErrors([]);
        return;
      }

      var timer = setTimeout(function () {
        try {
          var mapping;
          if (editorMode === "visual") {
            mapping = buildMappingFromVisual(mappingFields);
          } else if (editorMode === "json") {
            if (!codeEditorValue.trim()) {
              setPreviewOutput(null);
              setPreviewErrors([]);
              return;
            }
            mapping = JSON.parse(codeEditorValue);
          } else {
            if (!codeEditorValue.trim()) {
              setPreviewOutput(null);
              setPreviewErrors([]);
              return;
            }
            mapping = new Function("return " + codeEditorValue)();
          }

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

          var result = JsonTransformer.transform(sourceData, ready);
          setPreviewOutput(result);
        } catch (e) {
          setPreviewOutput(null);
          setPreviewErrors([{ message: "Transform error: " + e.message }]);
        }
      }, 200);

      return function () { clearTimeout(timer); };
    }, [sourceData, mappingFields, codeEditorValue, editorMode]);

    function buildMappingFromVisual(fields) {
      var mappingFields = {};
      fields.forEach(function (f) {
        if (!f.target || !f.source) return;
        var fieldDef = { from: f.source };
        if (f.type && f.type !== "auto") fieldDef.type = f.type;
        if (f.format) fieldDef.format = f.format;
        if (f.default !== undefined && f.default !== "") fieldDef.default = f.default;
        mappingFields[f.target] = fieldDef;
      });
      return { fields: mappingFields };
    }

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
        if (editorMode === "visual") {
          mapping = buildMappingFromVisual(mappingFields);
        } else if (editorMode === "json") {
          mapping = JSON.parse(codeEditorValue);
        } else {
          mapping = new Function("return " + codeEditorValue)();
        }
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
        content = editorMode === "js"
          ? "export default " + codeEditorValue.trim().replace(/;?\s*$/, "") + ";"
          : "export default " + JSON.stringify(mapping, null, 2) + ";";
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

    // Import mapping
    function handleMappingImport(e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        try {
          var text = ev.target.result;
          var mapping;
          if (file.name.endsWith(".json")) {
            mapping = JSON.parse(text);
            setEditorMode("json");
            setCodeEditorValue(JSON.stringify(mapping, null, 2));
          } else if (file.name.endsWith(".js")) {
            var clean = text.replace(/^export\s+default\s+/, "").replace(/;?\s*$/, "");
            mapping = new Function("return " + clean)();
            setEditorMode("js");
            setCodeEditorValue(clean);
          }
          if (mapping && mapping.fields) {
            setMappingFields(visualFieldsFromMapping(mapping));
          }
          computeWarningAck.current = false;
          showToast("Mapping imported", "success");
        } catch (err) {
          showToast("Failed to import mapping: " + err.message, "error");
        }
      };
      reader.readAsText(file);
    }

    // Sync code editor with visual fields when switching modes
    function switchMode(mode) {
      if (mode === "json" && editorMode === "visual" && mappingFields.length > 0) {
        var mapping = buildMappingFromVisual(mappingFields);
        setCodeEditorValue(JSON.stringify(mapping, null, 2));
      } else if (mode === "js" && editorMode === "visual" && mappingFields.length > 0) {
        var mappingJs = buildMappingFromVisual(mappingFields);
        setCodeEditorValue(JSON.stringify(mappingJs, null, 2));
      } else if (mode === "visual" && editorMode !== "visual") {
        try {
          var parsed = parseMappingFromCode(codeEditorValue, editorMode);
          if (parsed && parsed.fields) {
            setMappingFields(visualFieldsFromMapping(parsed));
          }
        } catch (e) {
          showToast("Cannot convert to visual mode: " + e.message, "error");
          return;
        }
      }
      setEditorMode(mode);
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
    function handleWizardComplete(mapping) {
      var fields = visualFieldsFromMapping(mapping);
      setMappingFields(fields);
      setEditorMode("visual");
      showToast("Wizard complete! " + fields.length + " fields mapped.", "success");
    }

    // Clear data
    function clearData() {
      setSourceData(null);
      setInspection(null);
      setPreviewOutput(null);
      setPreviewErrors([]);
      setSelectedPath("");
      computeWarningAck.current = false;
      if (fileInputRef.current) fileInputRef.current.value = "";
    }

    // Sync code editor value when in visual mode (keep it updated)
    useEffect(function () {
      if (editorMode === "visual" && mappingFields.length > 0) {
        var mapping = buildMappingFromVisual(mappingFields);
        setCodeEditorValue(JSON.stringify(mapping, null, 2));
      }
    }, [mappingFields]);

    return h("div", null,
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
            onChange: function (e) { if (e.target.value) loadSample(parseInt(e.target.value)); e.target.value = ""; },
          },
            h("option", { value: "" }, "Sample Data..."),
            SAMPLE_DATASETS.map(function (s, i) { return h("option", { key: i, value: i }, s.name); })
          ),
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
          // Clear
          h("button", {
            className: "btn btn-secondary",
            onClick: clearData,
          }, "\u2716 Clear"),
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
      // Main content
      h("main", { className: "app-main" },
        // Source tree panel
        h(SourceTreePanel, {
          data: sourceData,
          onSelect: handleTreeSelect,
          selectedPath: selectedPath,
        }),
        // Mapping editor panel
        h("div", { className: "panel panel-mapping" },
          h("div", { className: "panel-header" },
            h("span", { className: "panel-title" }, "Mapping Editor"),
            h("div", { className: "flex gap-1" },
              ["visual", "json", "js"].map(function (mode) {
                return h("button", {
                  key: mode,
                  className: "btn btn-sm " + (editorMode === mode ? "btn-primary" : "btn-secondary"),
                  onClick: function () { switchMode(mode); },
                }, mode === "visual" ? "Visual" : mode.toUpperCase());
              })
            )
          ),
          h("div", { className: "panel-body panel-body-mapping" },
            isLoading ? h("div", { className: "loading-spinner" }, "Processing...") : null,
            h(DataInspector, { inspection: inspection }),
            h("div", { className: "mapping-editor-scroll" },
              editorMode === "visual"
                ? h(VisualMappingEditor, {
                    fields: mappingFields,
                    onChange: setMappingFields,
                    inspection: inspection,
                  })
                : h(CodeEditor, {
                    mode: editorMode,
                    value: codeEditorValue,
                    onChange: setCodeEditorValue,
                  })
            )
          )
        ),
        // Preview panel
        h(PreviewPanel, {
          output: previewOutput,
          errors: previewErrors,
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
