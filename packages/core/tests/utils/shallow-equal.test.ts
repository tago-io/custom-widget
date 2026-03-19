import { shallowEqual } from "../../src/utils/shallow-equal.js";

describe("shallowEqual", () => {
  it("returns true for identical references", () => {
    const obj = { a: 1 };
    expect(shallowEqual(obj, obj)).toBe(true);
  });

  it("returns true for objects with same values", () => {
    expect(shallowEqual({ a: 1, b: "x" }, { a: 1, b: "x" })).toBe(true);
  });

  it("returns false for objects with different values", () => {
    expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  it("returns false for objects with different keys", () => {
    expect(shallowEqual({ a: 1 }, { b: 1 } as never)).toBe(false);
  });

  it("returns false for objects with different key counts", () => {
    expect(shallowEqual({ a: 1 }, { a: 1, b: 2 } as never)).toBe(false);
  });

  it("returns true for primitives", () => {
    expect(shallowEqual(1, 1)).toBe(true);
    expect(shallowEqual("a", "a")).toBe(true);
    expect(shallowEqual(null, null)).toBe(true);
  });

  it("returns false for different primitives", () => {
    expect(shallowEqual(1, 2)).toBe(false);
  });

  it("handles NaN correctly", () => {
    expect(shallowEqual(Number.NaN, Number.NaN)).toBe(true);
  });

  it("returns false when comparing object to null", () => {
    expect(shallowEqual({ a: 1 }, null as never)).toBe(false);
  });

  it("does not deep compare nested objects", () => {
    const nested1 = { a: { b: 1 } };
    const nested2 = { a: { b: 1 } };
    expect(shallowEqual(nested1, nested2)).toBe(false);
  });
});
