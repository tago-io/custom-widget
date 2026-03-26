import { describe, expect, it } from "vite-plus/test";

import type { TDataRecordInput, TWidgetVariable } from "../../src/types/index.js";
import { autoFillRecords } from "../../src/utils/auto-fill-records.js";

const widgetVars: TWidgetVariable[] = [
  { variable: "temp", origin: { id: "dev1", bucket: "bucket1" } },
  { variable: "humidity", origin: { id: "dev2" } },
];

describe("autoFillRecords", () => {
  it("returns empty array when both params are undefined", () => {
    expect(autoFillRecords(undefined, undefined)).toEqual([]);
  });

  it("returns empty array when records are undefined", () => {
    expect(autoFillRecords(undefined, widgetVars)).toEqual([]);
  });

  it("returns empty array when widget variables are undefined", () => {
    const records: TDataRecordInput[] = [{ variable: "temp", value: 42 }];
    expect(autoFillRecords(records, undefined)).toEqual([]);
  });

  it("fills device and bucket for matching variables", () => {
    const records: TDataRecordInput[] = [{ variable: "temp", value: 42 }];
    const result = autoFillRecords(records, widgetVars);
    expect(result).toEqual([{ variable: "temp", value: 42, device: "dev1", origin: "dev1", bucket: "bucket1" }]);
  });

  it("fills device without bucket when bucket is not defined", () => {
    const records: TDataRecordInput[] = [{ variable: "humidity", value: 60 }];
    const result = autoFillRecords(records, widgetVars);
    expect(result).toEqual([{ variable: "humidity", value: 60, device: "dev2", origin: "dev2" }]);
  });

  it("filters out records that don't match any widget variable", () => {
    const records: TDataRecordInput[] = [
      { variable: "temp", value: 42 },
      { variable: "unknown", value: 0 },
    ];
    const result = autoFillRecords(records, widgetVars);
    expect(result).toHaveLength(1);
    expect(result[0].variable).toBe("temp");
  });

  it("preserves existing fields from the record", () => {
    const records: TDataRecordInput[] = [{ variable: "temp", value: 42, group: "g1" }];
    const result = autoFillRecords(records, widgetVars);
    expect(result[0].group).toBe("g1");
  });
});
