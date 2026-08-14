import { describe, expect, it } from "vite-plus/test";

import { getInitialTheme } from "../../src/page/location.js";
import {
  normalizeSqlListResult,
  normalizeSqlRunResult,
  readInboundMessage,
  readResponseResult,
} from "../../src/protocol/messages.js";

const META = { op: "sql.run", requestID: "req-1" };

describe("readInboundMessage", () => {
  it("accepts the three host messages", () => {
    expect(readInboundMessage({ type: "dashboard:theme", theme: "dark" })).toEqual({ kind: "theme", theme: "dark" });
    expect(readInboundMessage({ type: "dashboard:style", style: {} })).toEqual({ kind: "style", style: {} });
    expect(readInboundMessage({ type: "dashboard:response", id: "a", ok: true, result: 1 })).toMatchObject({
      kind: "response",
      id: "a",
    });
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["string", "dashboard:theme"],
    ["number", 42],
    ["array", []],
    ["no type", { theme: "dark" }],
    ["non-string type", { type: 42 }],
    ["vite hmr", { type: "vite:beforeUpdate" }],
    ["react devtools", { source: "react-devtools-bridge", payload: {} }],
    ["unknown dashboard message", { type: "dashboard:whatever" }],
    ["our own ready echo", { type: "dashboard:ready" }],
    ["our own request echo", { type: "dashboard:request", id: "x", op: "sql.list" }],
  ])("ignores %s", (_label, data) => {
    expect(readInboundMessage(data)).toBeNull();
  });

  it("rejects a theme that is not dark or light", () => {
    expect(readInboundMessage({ type: "dashboard:theme", theme: "Dark" })).toBeNull();
    expect(readInboundMessage({ type: "dashboard:theme", theme: "" })).toBeNull();
    expect(readInboundMessage({ type: "dashboard:theme" })).toBeNull();
  });

  it("rejects a response without a usable id", () => {
    expect(readInboundMessage({ type: "dashboard:response", ok: true, result: 1 })).toBeNull();
    expect(readInboundMessage({ type: "dashboard:response", id: "", ok: true, result: 1 })).toBeNull();
  });
});

describe("readResponseResult", () => {
  it("returns the result, including falsy ones", () => {
    expect(readResponseResult({ ok: true, result: { rows: [] } }, META)).toEqual({ rows: [] });
    expect(readResponseResult({ ok: true, result: null }, META)).toBeNull();
  });

  it("throws with the host code and verbatim message", () => {
    expect(() => readResponseResult({ ok: false, error: { code: "not_found", message: "gone" } }, META)).toThrow(
      "gone"
    );
    try {
      readResponseResult({ ok: false, error: { code: "forbidden", message: "nope" } }, META);
    } catch (error) {
      expect(error).toMatchObject({ code: "forbidden", message: "nope", op: "sql.run", requestID: "req-1" });
    }
  });

  it("preserves an unrecognized code instead of flattening it", () => {
    try {
      readResponseResult({ ok: false, error: { code: "teapot", message: "brewing" } }, META);
    } catch (error) {
      expect(error).toMatchObject({ code: "teapot" });
    }
  });

  it.each([
    ["ok true with no result", { ok: true }],
    ["ok false with no error", { ok: false }],
    ["non-boolean ok", { ok: "yes" }],
    ["no ok at all", {}],
  ])("rejects %s rather than resolving undefined", (_label, body) => {
    expect(() => readResponseResult(body, META)).toThrow();
  });

  it("falls back when ok:false carries a broken error object", () => {
    try {
      readResponseResult({ ok: false, error: {} }, META);
    } catch (error) {
      expect(error).toMatchObject({ code: "api_error" });
    }
  });
});

describe("normalizeSqlRunResult", () => {
  it("passes a well-formed result through", () => {
    const result = normalizeSqlRunResult(
      {
        columns: ["a", "b"],
        rows: [{ a: 1, b: 2 }],
        meta: { row_count: 1, execution_ms: 12, served_from_cache: true },
      },
      META
    );
    expect(result).toEqual({
      columns: ["a", "b"],
      rows: [{ a: 1, b: 2 }],
      meta: { row_count: 1, execution_ms: 12, served_from_cache: true },
    });
  });

  it("drops rows that would break Object.keys downstream", () => {
    const result = normalizeSqlRunResult({ rows: [{ a: 1 }, null, 3, "x", []] }, META);
    expect(result.rows).toEqual([{ a: 1 }]);
  });

  it("filters non-string columns and synthesizes a missing meta", () => {
    const result = normalizeSqlRunResult({ columns: ["a", 2, null, "b"] }, META);
    expect(result.columns).toEqual(["a", "b"]);
    expect(result.meta).toEqual({ row_count: null, execution_ms: null, served_from_cache: false });
  });

  it("nulls non-numeric meta values", () => {
    const result = normalizeSqlRunResult({ meta: { row_count: "12", execution_ms: Number.NaN } }, META);
    expect(result.meta.row_count).toBeNull();
    expect(result.meta.execution_ms).toBeNull();
  });

  it("throws when the result is not an object at all", () => {
    expect(() => normalizeSqlRunResult(null, META)).toThrow();
    expect(() => normalizeSqlRunResult("rows", META)).toThrow();
  });
});

describe("normalizeSqlListResult", () => {
  it("defaults a missing name to the id, mirroring the host", () => {
    expect(normalizeSqlListResult({ queries: [{ id: "abc" }, { id: "d", name: "Named" }] }, META)).toEqual([
      { id: "abc", name: "abc" },
      { id: "d", name: "Named" },
    ]);
  });

  it("skips entries without a string id", () => {
    expect(normalizeSqlListResult({ queries: [{ name: "orphan" }, null, { id: 5 }] }, META)).toEqual([]);
  });

  it("returns empty when queries is not an array", () => {
    expect(normalizeSqlListResult({}, META)).toEqual([]);
  });
});

describe("getInitialTheme", () => {
  it.each([
    ["?theme=dark", "dark"],
    ["theme=dark", "dark"],
    ["?theme=light", "light"],
    ["?theme=Dark", "light"],
    ["?theme=", "light"],
    ["", "light"],
    ["?theme=<script>", "light"],
    ["?exp=1&sig=2&theme=dark&v=1", "dark"],
  ])("maps %s to %s", (search, expected) => {
    expect(getInitialTheme(search)).toBe(expected);
  });
});
