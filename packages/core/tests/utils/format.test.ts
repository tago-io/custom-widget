import { formatValue } from "../../src/utils/format-value.js";
import { formatDate } from "../../src/utils/format-date.js";

describe("formatValue", () => {
  it("formats a number", () => {
    const result = formatValue(1234.5, { locale: "en-US" });
    expect(result).toBe("1,234.5");
  });

  it("formats a numeric string", () => {
    const result = formatValue("1234.5", { locale: "en-US" });
    expect(result).toBe("1,234.5");
  });

  it("returns non-numeric strings as-is", () => {
    expect(formatValue("hello")).toBe("hello");
  });

  it("returns boolean as string", () => {
    expect(formatValue(true)).toBe("true");
    expect(formatValue(false)).toBe("false");
  });

  it("returns empty string for undefined", () => {
    expect(formatValue(undefined)).toBe("");
  });

  it("respects fraction digits options", () => {
    const result = formatValue(1.1, { locale: "en-US", minimumFractionDigits: 2 });
    expect(result).toBe("1.10");
  });
});

describe("formatDate", () => {
  it("formats a date string", () => {
    const result = formatDate("2024-01-15T12:00:00Z", { locale: "en-US", dateStyle: "short" });
    expect(result).toContain("1/15");
  });

  it("formats a Date object", () => {
    const result = formatDate(new Date("2024-06-15T12:00:00Z"), { locale: "en-US", dateStyle: "short" });
    expect(result).toContain("6/15");
  });

  it("returns original string for invalid date", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date");
  });

  it("formats relative dates", () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = formatDate(yesterday, { relative: true, locale: "en-US" });
    expect(result).toContain("yesterday");
  });
});
