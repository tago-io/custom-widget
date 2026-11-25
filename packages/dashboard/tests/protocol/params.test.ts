import { describe, expect, it } from "vite-plus/test";

import { isValidQueryId, serializeQueryParams } from "../../src/protocol/params.js";

const VALID_ID = "6fdbb0f233ea47fa36d331fa";

describe("isValidQueryId", () => {
  it.each([VALID_ID, "aaaaaaaaaaaaaaaaaaaaaaaa", "6FDBB0F233EA47FA36D331FA"])("accepts %s", (id) => {
    expect(isValidQueryId(id)).toBe(true);
  });

  it.each([
    ["empty", ""],
    ["23 chars", "6fdbb0f233ea47fa36d331f"],
    ["25 chars", "6fdbb0f233ea47fa36d331fab"],
    ["path traversal", "../account"],
    ["slash", "a/b"],
    ["query string", "x?y=1"],
    ["padded", ` ${VALID_ID} `],
  ])("rejects %s", (_label, id) => {
    expect(isValidQueryId(id)).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(isValidQueryId(undefined)).toBe(false);
    expect(isValidQueryId(null)).toBe(false);
    expect(isValidQueryId(42)).toBe(false);
  });
});

describe("serializeQueryParams", () => {
  it("is empty for no params", () => {
    expect(serializeQueryParams()).toBe("");
    expect(serializeQueryParams([])).toBe("");
  });

  it("is stable regardless of the caller's ordering", () => {
    const ascending = serializeQueryParams([
      { key: "$1", value: "a" },
      { key: "$2", value: "b" },
    ]);
    const descending = serializeQueryParams([
      { key: "$2", value: "b" },
      { key: "$1", value: "a" },
    ]);
    expect(ascending).toBe(descending);
  });

  it("orders placeholders numerically, not lexically", () => {
    const key = serializeQueryParams([
      { key: "$10", value: "ten" },
      { key: "$2", value: "two" },
    ]);
    expect(key.indexOf("two")).toBeLessThan(key.indexOf("ten"));
  });

  it("separates different values", () => {
    const first = serializeQueryParams([{ key: "$1", value: "30" }]);
    const second = serializeQueryParams([{ key: "$1", value: "60" }]);
    expect(first).not.toBe(second);
  });
});
