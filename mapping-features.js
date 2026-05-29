/**
 * mapping-features.js — Mapping build/parse, compute templates, validation
 * Used by app.js (loaded before app.js in index.html)
 */
(function (global) {
  "use strict";

  var COMPUTE_PARAM_NAMES = ["a", "b", "c", "d", "e", "f", "g", "h"];

  var COMPUTE_TEMPLATES = [
    {
      id: "concat",
      label: "Concatenate two fields",
      params: ["a", "b"],
      code: 'return [a, b].filter(function(v) { return v != null && v !== ""; }).join(" ");',
      sourceHint: "Two source paths (comma-separated)",
    },
    {
      id: "concat3",
      label: "Concatenate three fields",
      params: ["a", "b", "c"],
      code: 'return [a, b, c].filter(function(v) { return v != null && v !== ""; }).join(" ");',
      sourceHint: "Three source paths (comma-separated)",
    },
    {
      id: "add",
      label: "Add numbers (a + b)",
      params: ["a", "b"],
      code: "return Number(a) + Number(b);",
      sourceHint: "Two numeric source paths",
    },
    {
      id: "subtract",
      label: "Subtract (a - b)",
      params: ["a", "b"],
      code: "return Number(a) - Number(b);",
      sourceHint: "Two numeric source paths",
    },
    {
      id: "multiply",
      label: "Multiply (a × b)",
      params: ["a", "b"],
      code: "return Number(a) * Number(b);",
      sourceHint: "Two numeric source paths",
    },
    {
      id: "divide",
      label: "Divide (a ÷ b)",
      params: ["a", "b"],
      code: "return Number(b) !== 0 ? Number(a) / Number(b) : null;",
      sourceHint: "Two numeric source paths",
    },
    {
      id: "round",
      label: "Round number",
      params: ["a"],
      code: "return Math.round(Number(a) * 100) / 100;",
      sourceHint: "One numeric source path",
    },
    {
      id: "length",
      label: "String length",
      params: ["a"],
      code: 'return a == null ? 0 : String(a).length;',
      sourceHint: "One source path",
    },
    {
      id: "custom",
      label: "Custom expression",
      params: COMPUTE_PARAM_NAMES,
      code: "return a;",
      sourceHint: "Use parameters a, b, c… in your return statement",
    },
  ];

  function defaultVisualField(overrides) {
    return Object.assign({
      target: "",
      source: "",
      type: "auto",
      format: "",
      default: "",
      kind: "simple",
      coalesce: "",
      mapPairs: "",
      forEachPath: "",
      nestedFields: [],
      computeTemplate: "concat",
      computeSources: "",
      computeCode: COMPUTE_TEMPLATES[0].code,
    }, overrides || {});
  }

  function parseMapPairs(text) {
    if (!text || !String(text).trim()) return null;
    var map = {};
    String(text).split(",").forEach(function (pair) {
      var idx = pair.indexOf(":");
      if (idx < 0) return;
      var k = pair.slice(0, idx).trim();
      var v = pair.slice(idx + 1).trim();
      if (k) map[k] = v;
    });
    return Object.keys(map).length ? map : null;
  }

  function parseCoalesce(text) {
    if (!text || !String(text).trim()) return null;
    return String(text).split(",").map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function parseSourceList(text) {
    if (!text || !String(text).trim()) return [];
    return String(text).split(",").map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function makeComputeFn(code) {
    if (!global.JsonTransformer || !global.JsonTransformer.compileCompute) {
      return function () {
        throw new Error("Compute engine not available");
      };
    }
    return global.JsonTransformer.compileCompute(code);
  }

  function buildSimpleFieldDef(f) {
    var fieldDef = {};
    if (f.source) fieldDef.from = f.source;
    if (f.type && f.type !== "auto") fieldDef.type = f.type;
    if (f.format) fieldDef.format = f.format;
    if (f.outputFormat) fieldDef.outputFormat = f.outputFormat;
    if (f.default !== undefined && f.default !== "") fieldDef.default = f.default;
    if (f.template) fieldDef.template = f.template;
    if (f.value !== undefined && f.value !== "") fieldDef.value = f.value;
    var coalesce = parseCoalesce(f.coalesce);
    if (coalesce && coalesce.length) fieldDef.coalesce = coalesce;
    var map = parseMapPairs(f.mapPairs);
    if (map) fieldDef.map = map;
    return fieldDef;
  }

  function fieldDefIsAdvanced(def) {
    if (!def || typeof def !== "object") return false;
    if (def.if || def.and || def.or || def.not) return true;
    if (def.template !== undefined || "value" in def) return true;
    if (def.groupBy || def.flatten || def.filter || def.distinct || def.sortBy) return true;
    if (typeof def.compute === "function" || typeof def.compute === "string") return true;
    if (def.fields) {
      return Object.keys(def.fields).some(function (k) {
        return fieldDefIsAdvanced(def.fields[k]);
      });
    }
    return false;
  }

  function mappingRequiresCodeEditor(mapping) {
    if (!mapping || typeof mapping !== "object") return false;
    if (mapping.schema || mapping.dictionaries) return true;
    if (mapping.passthrough && typeof mapping.passthrough === "object") return true;
    if (!mapping.fields || typeof mapping.fields !== "object") return false;
    return Object.keys(mapping.fields).some(function (k) {
      return fieldDefIsAdvanced(mapping.fields[k]);
    });
  }

  function stripModuleWrapper(text) {
    var clean = String(text).trim();
    clean = clean.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, "");
    clean = clean.replace(/^export\s+default\s+/m, "").trim();
    if (clean.endsWith(";")) clean = clean.slice(0, -1);
    return clean;
  }

  function parseMappingModule(text) {
    var clean = stripModuleWrapper(text);
    return new Function("return (" + clean + ")")();
  }

  function extractMappingMeta(mapping) {
    if (!mapping || typeof mapping !== "object") return {};
    return {
      id: mapping.id,
      version: mapping.version,
      passthrough: mapping.passthrough,
      schema: mapping.schema,
      dictionaries: mapping.dictionaries,
    };
  }

  function applyMappingMeta(mapping, meta) {
    if (!mapping || !meta) return mapping;
    if (meta.id) mapping.id = meta.id;
    if (meta.version) mapping.version = meta.version;
    if (meta.schema) mapping.schema = meta.schema;
    if (meta.dictionaries) mapping.dictionaries = meta.dictionaries;
    if (meta.passthrough !== undefined && meta.passthrough !== null) {
      mapping.passthrough = meta.passthrough;
    }
    return mapping;
  }

  function buildFullMapping(fields, options) {
    var mapping = buildMappingFromVisualFields(fields, options);
    return applyMappingMeta(mapping, options && options.meta);
  }

  function passthroughToBool(passthrough) {
    if (passthrough === true) return true;
    if (passthrough && typeof passthrough === "object") return true;
    return false;
  }

  function buildNestedFieldsDef(nestedFields) {
    var sub = {};
    (nestedFields || []).forEach(function (sf) {
      if (!sf.target) return;
      sub[sf.target] = visualFieldToDef(sf);
    });
    return sub;
  }

  function visualFieldToDef(f) {
    if (!f || !f.target) return null;

    if (f.kind === "forEach") {
      var path = f.forEachPath || f.source;
      if (!path) return null;
      var fe = {
        forEach: path,
        fields: buildNestedFieldsDef(f.nestedFields),
      };
      if (f.groupBy) fe.groupBy = f.groupBy;
      if (f.flatten) fe.flatten = f.flatten;
      return fe;
    }

    if (f.kind === "nested") {
      return { fields: buildNestedFieldsDef(f.nestedFields) };
    }

    if (f.kind === "compute") {
      var paths = parseSourceList(f.computeSources || f.source);
      if (!paths.length) return null;
      var code = f.computeCode || "return a;";
      var fieldDef = {
        from: paths.length === 1 ? paths[0] : paths,
        compute: makeComputeFn(code),
      };
      if (f.format) fieldDef.format = f.format;
      return fieldDef;
    }

    if (!f.source && !parseCoalesce(f.coalesce)) return null;
    return buildSimpleFieldDef(f);
  }

  function defToVisualField(target, def) {
    if (!def || typeof def !== "object") return defaultVisualField({ target: target });

    if (fieldDefIsAdvanced(def) && def.forEach === undefined && !(def.fields && !def.from)) {
      return defaultVisualField({
        target: target,
        kind: "advanced",
        source: "",
      });
    }

    if (def.forEach !== undefined && def.fields) {
      var nested = [];
      Object.keys(def.fields).forEach(function (k) {
        var child = defToVisualField(k, def.fields[k]);
        nested.push(child);
      });
      return defaultVisualField({
        target: target,
        kind: "forEach",
        forEachPath: def.forEach,
        source: def.forEach,
        groupBy: def.groupBy || "",
        flatten: def.flatten || "",
        nestedFields: nested,
      });
    }

    if (def.fields && !def.from && !def.forEach) {
      var nestedObj = [];
      Object.keys(def.fields).forEach(function (k) {
        nestedObj.push(defToVisualField(k, def.fields[k]));
      });
      return defaultVisualField({
        target: target,
        kind: "nested",
        nestedFields: nestedObj,
      });
    }

    if (typeof def.compute === "function") {
      return defaultVisualField({
        target: target,
        kind: "compute",
        source: Array.isArray(def.from) ? def.from.join(", ") : (def.from || ""),
        computeSources: Array.isArray(def.from) ? def.from.join(", ") : (def.from || ""),
        computeTemplate: "custom",
        computeCode: "return a;",
        format: def.format || "",
      });
    }

    var vf = defaultVisualField({
      target: target,
      kind: "simple",
      source: Array.isArray(def.from) ? def.from[0] : (def.from || ""),
      type: def.type || "auto",
      format: def.format || "",
      outputFormat: def.outputFormat || "",
      default: def.default != null ? String(def.default) : "",
      template: def.template != null ? String(def.template) : "",
      value: "value" in def ? String(def.value) : "",
    });
    if (Array.isArray(def.coalesce)) vf.coalesce = def.coalesce.join(", ");
    if (def.map && typeof def.map === "object") {
      vf.mapPairs = Object.keys(def.map).map(function (k) { return k + ":" + def.map[k]; }).join(", ");
    }
    return vf;
  }

  function buildMappingFromVisualFields(fields, options) {
    options = options || {};
    var out = {};
    (fields || []).forEach(function (f) {
      if (!f.target || f.kind === "advanced") return;
      var def = visualFieldToDef(f);
      if (def) out[f.target] = def;
    });
    var mapping = { fields: out };
    if (options.passthrough === true) mapping.passthrough = true;
    return applyMappingMeta(mapping, options.meta);
  }

  function visualFieldsFromMapping(mapping) {
    if (!mapping || !mapping.fields) return [];
    var list = [];
    Object.keys(mapping.fields).forEach(function (target) {
      list.push(defToVisualField(target, mapping.fields[target]));
    });
    return list;
  }

  function fieldSummaryKind(def) {
    if (!def || typeof def !== "object") return "unknown";
    if (fieldDefIsAdvanced(def)) return "advanced";
    if (def.forEach !== undefined) return "forEach";
    if (def.fields && !def.from) return "nested";
    if (typeof def.compute === "function" || typeof def.compute === "string") return "compute";
    if (def.if) return "condition";
    return "simple";
  }

  function fieldSummaryFromMapping(mapping) {
    if (!mapping || !mapping.fields) return [];
    return Object.keys(mapping.fields).map(function (target) {
      var def = mapping.fields[target];
      return {
        target: target,
        kind: fieldSummaryKind(def),
        label: fieldSummaryKind(def) === "advanced" || def.if
          ? "condition / advanced"
          : def.from
            ? (Array.isArray(def.from) ? def.from.join(", ") : String(def.from))
            : "",
      };
    });
  }

  function pathExistsInData(data, path) {
    if (!data || !path) return false;
    var JT = global.JsonTransformer;
    if (!JT || !JT.resolvePath) return true;
    var records = Array.isArray(data) ? data : [data];
    return records.some(function (row) {
      return JT.resolvePath(row, path) !== undefined;
    });
  }

  function validateVisualFields(fields, sourceData) {
    var errors = [];
    (fields || []).forEach(function (f, i) {
      if (!f.target || !String(f.target).trim()) {
        errors.push({ index: i, target: f.target, message: "Missing target field name" });
      }
      if (f.kind === "simple" || f.kind === "compute") {
        var paths = f.kind === "compute"
          ? parseSourceList(f.computeSources || f.source)
          : [f.source].concat(parseCoalesce(f.coalesce) || []);
        paths.filter(Boolean).forEach(function (p) {
          if (sourceData && !pathExistsInData(sourceData, p)) {
            errors.push({
              index: i,
              target: f.target,
              message: 'Source path "' + p + '" not found in loaded data',
            });
          }
        });
      }
      if (f.kind === "forEach" && f.forEachPath && sourceData && !pathExistsInData(sourceData, f.forEachPath)) {
        errors.push({
          index: i,
          target: f.target,
          message: 'forEach path "' + f.forEachPath + '" not found in loaded data',
        });
      }
      if ((f.kind === "forEach" || f.kind === "nested") && (!f.nestedFields || !f.nestedFields.length)) {
        errors.push({
          index: i,
          target: f.target,
          message: "Add at least one nested field mapping",
        });
      }
    });
    return errors;
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

  function getSampleValuesForPath(data, path, max) {
    max = max || 3;
    if (!data || !path) return [];
    var JT = global.JsonTransformer;
    var values = [];
    var seen = {};
    var records = Array.isArray(data) ? data : [data];
    for (var i = 0; i < records.length && values.length < max; i++) {
      var v = JT ? JT.resolvePath(records[i], path) : undefined;
      if (v === undefined || v === null) continue;
      if (typeof v === "object") continue;
      var s = String(v);
      if (!seen[s]) {
        seen[s] = true;
        values.push(s);
      }
    }
    return values;
  }

  function diffRecords(expected, actual) {
    var lines = [];
    if (expected === actual) {
      return [{ type: "same", text: "Records match" }];
    }
    if (expected == null || actual == null) {
      lines.push({ type: "removed", text: "Expected: " + JSON.stringify(expected) });
      lines.push({ type: "added", text: "Actual:   " + JSON.stringify(actual) });
      return lines;
    }
    if (typeof expected !== "object" || typeof actual !== "object") {
      lines.push({ type: "changed", text: "Expected: " + JSON.stringify(expected) });
      lines.push({ type: "changed", text: "Actual:   " + JSON.stringify(actual) });
      return lines;
    }
    var keys = {};
    Object.keys(expected).forEach(function (k) { keys[k] = true; });
    Object.keys(actual).forEach(function (k) { keys[k] = true; });
    Object.keys(keys).sort().forEach(function (k) {
      var ev = expected[k];
      var av = actual[k];
      if (JSON.stringify(ev) === JSON.stringify(av)) {
        lines.push({ type: "same", text: k + ": " + JSON.stringify(av) });
      } else if (!(k in expected)) {
        lines.push({ type: "added", text: "+ " + k + ": " + JSON.stringify(av) });
      } else if (!(k in actual)) {
        lines.push({ type: "removed", text: "- " + k + ": " + JSON.stringify(ev) });
      } else {
        lines.push({ type: "changed", text: "~ " + k + ": " + JSON.stringify(ev) + " → " + JSON.stringify(av) });
      }
    });
    return lines;
  }

  global.MappingFeatures = {
    COMPUTE_TEMPLATES: COMPUTE_TEMPLATES,
    defaultVisualField: defaultVisualField,
    buildMappingFromVisualFields: buildMappingFromVisualFields,
    buildFullMapping: buildFullMapping,
    visualFieldsFromMapping: visualFieldsFromMapping,
    fieldSummaryFromMapping: fieldSummaryFromMapping,
    visualFieldToDef: visualFieldToDef,
    validateVisualFields: validateVisualFields,
    mappingHasCompute: mappingHasCompute,
    mappingRequiresCodeEditor: mappingRequiresCodeEditor,
    parseMappingModule: parseMappingModule,
    stripModuleWrapper: stripModuleWrapper,
    extractMappingMeta: extractMappingMeta,
    applyMappingMeta: applyMappingMeta,
    passthroughToBool: passthroughToBool,
    fieldDefIsAdvanced: fieldDefIsAdvanced,
    getSampleValuesForPath: getSampleValuesForPath,
    diffRecords: diffRecords,
    parseSourceList: parseSourceList,
  };
})(typeof window !== "undefined" ? window : globalThis);
