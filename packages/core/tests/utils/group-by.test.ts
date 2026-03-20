import type { TDataRecord } from "../../src/types/index.js";
import { getLatestByVariable } from "../../src/utils/get-latest-by-variable.js";
import { groupByDevice } from "../../src/utils/group-by-device.js";
import { groupByVariable } from "../../src/utils/group-by-variable.js";

const records: TDataRecord[] = [
  { id: "1", variable: "temp", value: 20, device: "d1", time: "2024-01-01T00:00:00Z" },
  { id: "2", variable: "temp", value: 25, device: "d1", time: "2024-01-02T00:00:00Z" },
  { id: "3", variable: "humidity", value: 60, device: "d2", time: "2024-01-01T00:00:00Z" },
  { id: "4", variable: "humidity", value: 65, device: "d2", time: "2024-01-03T00:00:00Z" },
];

describe("groupByVariable", () => {
  it("groups records by variable name", () => {
    const groups = groupByVariable(records);
    expect(Object.keys(groups)).toEqual(["temp", "humidity"]);
    expect(groups.temp).toHaveLength(2);
    expect(groups.humidity).toHaveLength(2);
  });

  it("returns empty object for empty array", () => {
    expect(groupByVariable([])).toEqual({});
  });
});

describe("groupByDevice", () => {
  it("groups records by device id", () => {
    const groups = groupByDevice(records);
    expect(Object.keys(groups)).toEqual(["d1", "d2"]);
    expect(groups.d1).toHaveLength(2);
    expect(groups.d2).toHaveLength(2);
  });

  it("falls back to origin when device is not set", () => {
    const withOrigin: TDataRecord[] = [{ id: "1", variable: "temp", value: 20, origin: "o1", time: "t1" }];
    const groups = groupByDevice(withOrigin);
    expect(groups.o1).toHaveLength(1);
  });

  it("uses 'unknown' when neither device nor origin is set", () => {
    const noDevice: TDataRecord[] = [{ id: "1", variable: "temp", value: 20, time: "t1" }];
    const groups = groupByDevice(noDevice);
    expect(groups.unknown).toHaveLength(1);
  });

  it("returns empty object for empty array", () => {
    expect(groupByDevice([])).toEqual({});
  });
});

describe("getLatestByVariable", () => {
  it("returns the most recent record per variable", () => {
    const latest = getLatestByVariable(records);
    expect(latest.temp.id).toBe("2");
    expect(latest.humidity.id).toBe("4");
  });

  it("returns empty object for empty array", () => {
    expect(getLatestByVariable([])).toEqual({});
  });
});
