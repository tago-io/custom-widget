import { describe, expect, it } from "vite-plus/test";

import { generateId } from "../../src/bridge/generate-id.js";

describe("generateId", () => {
  it("returns a string", () => {
    expect(typeof generateId()).toBe("string");
  });

  it("returns unique values on successive calls", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });

  it("uses crypto.randomUUID when available", () => {
    const uuid = "test-uuid-1234";
    const original = crypto.randomUUID;
    crypto.randomUUID = () => uuid as `${string}-${string}-${string}-${string}-${string}`;
    try {
      expect(generateId()).toBe(uuid);
    } finally {
      crypto.randomUUID = original;
    }
  });

  it("falls back when crypto.randomUUID is unavailable", () => {
    const original = crypto.randomUUID;
    Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
    try {
      const id = generateId();
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    } finally {
      Object.defineProperty(crypto, "randomUUID", { value: original, configurable: true });
    }
  });
});
