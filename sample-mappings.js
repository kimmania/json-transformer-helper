/**
 * sample-mappings.js — Catalog of json-transformer CLI sample mappings + test data
 * Files live in ./samples/ (copied from ../json-transformer).
 * Load via HTTP server (e.g. python3 -m http.server) or use Import for file://.
 */
(function (global) {
  "use strict";

  var CATALOG = [
    {
      id: "nested-json",
      name: "Nested order (JSON)",
      mapping: "samples/mapping-nested.json",
      data: "samples/test-nested.json",
      description: "forEach line items, nested shipping, conditions",
    },
    {
      id: "crm-json",
      name: "CRM legacy → modern (JSON)",
      mapping: "samples/mapping-crm-example.json",
      data: "samples/test-data.json",
      description: "Value maps, dates, simple conditions",
    },
    {
      id: "nested-js",
      name: "Nested order + compute (JS)",
      mapping: "samples/mapping-nested.js",
      data: "samples/test-nested.json",
      description: "Same as nested JSON with line_total compute",
    },
    {
      id: "employee-js",
      name: "Employee conditions (JS)",
      mapping: "samples/mapping-employee.js",
      data: "samples/test-employees.json",
      description: "Composite and/or/not conditions",
    },
    {
      id: "data-cleaning-js",
      name: "Data cleaning (JS)",
      mapping: "samples/mapping-data-cleaning.js",
      data: "samples/test-data-cleaning.json",
      description: "Passthrough, template, coalesce, compute",
    },
    {
      id: "shaping-js",
      name: "Data shaping (JS)",
      mapping: "samples/mapping-shaping.js",
      data: "samples/test-shaping.json",
      description: "groupBy, flatten, aggregates",
    },
    {
      id: "crm-js",
      name: "CRM example (JS)",
      mapping: "samples/mapping-crm-example.js",
      data: "samples/test-data.json",
      description: "JS variant of CRM mapping",
    },
    {
      id: "validated-js",
      name: "Schema validated (JS)",
      mapping: "samples/mapping-validated.js",
      data: "samples/test-data.json",
      description: "Mapping with schema validation",
    },
    {
      id: "timesheet-js",
      name: "Timesheet (JS)",
      mapping: "samples/mapping-timesheet.js",
      data: "samples/test-data.json",
      description: "Timesheet transform example",
    },
  ];

  function fetchText(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status + " for " + url);
      return res.text();
    });
  }

  function loadPair(entry) {
    return Promise.all([
      fetchText(entry.mapping),
      fetchText(entry.data),
    ]).then(function (results) {
      return {
        mappingText: results[0],
        mappingPath: entry.mapping,
        dataText: results[1],
        dataPath: entry.data,
        entry: entry,
      };
    });
  }

  function getById(id) {
    return CATALOG.find(function (e) { return e.id === id; });
  }

  global.SampleMappings = {
    CATALOG: CATALOG,
    loadPair: loadPair,
    getById: getById,
    fetchText: fetchText,
  };
})(typeof window !== "undefined" ? window : globalThis);
