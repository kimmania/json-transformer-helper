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
    if (f.default !== undefined && f.default !== "") fieldDef.default = f.default;
    var coalesce = parseCoalesce(f.coalesce);
    if (coalesce && coalesce.length) fieldDef.coalesce = coalesce;
    var map = parseMapPairs(f.mapPairs);
    if (map) fieldDef.map = map;
    return fieldDef;
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
      return {
        forEach: path,
        fields: buildNestedFieldsDef(f.nestedFields),
      };
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
      default: def.default != null ? String(def.default) : "",
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
      if (!f.target) return;
      var def = visualFieldToDef(f);
      if (def) out[f.target] = def;
    });
    var mapping = { fields: out };
    if (options.passthrough) mapping.passthrough = true;
    return mapping;
  }

  function visualFieldsFromMapping(mapping) {
    if (!mapping || !mapping.fields) return [];
    var list = [];
    Object.keys(mapping.fields).forEach(function (target) {
      list.push(defToVisualField(target, mapping.fields[target]));
    });
    return list;
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
    visualFieldsFromMapping: visualFieldsFromMapping,
    visualFieldToDef: visualFieldToDef,
    validateVisualFields: validateVisualFields,
    mappingHasCompute: mappingHasCompute,
    getSampleValuesForPath: getSampleValuesForPath,
    diffRecords: diffRecords,
    parseSourceList: parseSourceList,
  };
})(typeof window !== "undefined" ? window : globalThis);
