import { describe, expect, it } from "vite-plus/test";

import { appendStrategy, mergeStrategy, replaceStrategy } from "../../src/store/realtime-strategies.js";
import type { TDataRecord, TRealtimeData, TResource, TResourceRecord, TResourceType } from "../../src/types/index.js";

const record = (id: string, variable: string, value: string | number, time = "2024-01-01T00:00:00Z"): TDataRecord => ({
  id,
  variable,
  value,
  time,
});

const block = (variables: string[], origin: string, records: TDataRecord[]): TRealtimeData => ({
  data: { variable: variables, origin },
  result: records,
});

const resourceBlock = (
  type: TResourceType,
  result: TResourceRecord[],
  resource: Omit<Partial<TResource>, "type"> = {}
): TRealtimeData => ({
  resource: { type, ...resource },
  result,
});

describe("replaceStrategy", () => {
  it("replaces existing data with incoming data", () => {
    const existing = [block(["temp"], "d1", [record("1", "temp", 20)])];
    const incoming = [block(["temp"], "d1", [record("1", "temp", 25)])];
    expect(replaceStrategy(existing, incoming)).toBe(incoming);
  });

  it("returns incoming even when existing is empty", () => {
    const incoming = [block(["temp"], "d1", [record("1", "temp", 25)])];
    expect(replaceStrategy([], incoming)).toBe(incoming);
  });
});

describe("appendStrategy", () => {
  it("concatenates incoming data", () => {
    const existing = [block(["temp"], "d1", [record("1", "temp", 20)])];
    const incoming = [block(["temp"], "d1", [record("2", "temp", 25)])];
    const result = appendStrategy(existing, incoming, 100);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(existing[0]);
    expect(result[1]).toBe(incoming[0]);
  });

  it("caps at maxRecords using FIFO", () => {
    const existing = [block(["a"], "d1", [record("1", "a", 1)]), block(["b"], "d1", [record("2", "b", 2)])];
    const incoming = [block(["c"], "d1", [record("3", "c", 3)])];
    const result = appendStrategy(existing, incoming, 2);
    expect(result).toHaveLength(2);
    expect(result[0].data?.variable).toEqual(["b"]);
    expect(result[1].data?.variable).toEqual(["c"]);
  });

  it("returns combined when under limit", () => {
    const existing = [block(["a"], "d1", [record("1", "a", 1)])];
    const incoming = [block(["b"], "d1", [record("2", "b", 2)])];
    const result = appendStrategy(existing, incoming, 10);
    expect(result).toHaveLength(2);
  });
});

describe("mergeStrategy", () => {
  it("returns incoming when existing is empty", () => {
    const incoming = [block(["temp"], "d1", [record("1", "temp", 25)])];
    expect(mergeStrategy([], incoming)).toBe(incoming);
  });

  it("returns existing when incoming is empty", () => {
    const existing = [block(["temp"], "d1", [record("1", "temp", 20)])];
    expect(mergeStrategy(existing, [])).toBe(existing);
  });

  it("merges records within matching blocks", () => {
    const r1 = record("1", "temp", 20);
    const existing = [block(["temp"], "d1", [r1])];
    const r1Updated = record("1", "temp", 25);
    const incoming = [block(["temp"], "d1", [r1Updated])];

    const result = mergeStrategy(existing, incoming);
    expect(result).toHaveLength(1);
    expect(result[0].result![0].value).toBe(25);
  });

  it("preserves reference for unchanged records (structural sharing)", () => {
    const r1 = record("1", "temp", 20);
    const r2 = record("2", "humidity", 60);
    const existing = [block(["temp", "humidity"], "d1", [r1, r2])];
    const r1Updated = record("1", "temp", 25);
    const incoming = [block(["temp", "humidity"], "d1", [r1Updated, r2])];

    const result = mergeStrategy(existing, incoming);
    expect(result[0].result![0]).toBe(r1Updated);
    expect(result[0].result![1]).toBe(r2);
  });

  it("removes records not present in incoming (deleted)", () => {
    const r1 = record("1", "temp", 20);
    const r2 = record("2", "temp", 30);
    const existing = [block(["temp"], "d1", [r1, r2])];
    const incoming = [block(["temp"], "d1", [r2])];

    const result = mergeStrategy(existing, incoming);
    expect(result[0].result).toHaveLength(1);
    expect(result[0].result![0]).toBe(r2);
  });

  it("adds new blocks that don't exist in existing", () => {
    const existing = [block(["temp"], "d1", [record("1", "temp", 20)])];
    const incoming = [block(["humidity"], "d2", [record("2", "humidity", 60)])];

    const result = mergeStrategy(existing, incoming);
    expect(result).toHaveLength(2);
  });

  it("preserves existing blocks not in incoming", () => {
    const existingBlock = block(["humidity"], "d2", [record("2", "humidity", 60)]);
    const existing = [block(["temp"], "d1", [record("1", "temp", 20)]), existingBlock];
    const incoming = [block(["temp"], "d1", [record("1", "temp", 25)])];

    const result = mergeStrategy(existing, incoming);
    expect(result).toHaveLength(2);
    expect(result[1]).toBe(existingBlock);
  });

  it("sorts merged records by time descending", () => {
    const existing = [
      block(["temp"], "d1", [
        record("1", "temp", 20, "2024-01-01T00:00:00Z"),
        record("2", "temp", 25, "2024-01-03T00:00:00Z"),
      ]),
    ];
    const incoming = [
      block(["temp"], "d1", [
        record("1", "temp", 22, "2024-01-01T00:00:00Z"),
        record("2", "temp", 25, "2024-01-03T00:00:00Z"),
        record("3", "temp", 30, "2024-01-02T00:00:00Z"),
      ]),
    ];

    const result = mergeStrategy(existing, incoming);
    const records = result[0].result!;
    expect(records).toHaveLength(3);
    expect(records[0].id).toBe("2"); // Jan 3 (newest)
    expect(records[1].id).toBe("3"); // Jan 2
    expect(records[2].id).toBe("1"); // Jan 1 (oldest)
  });

  it("returns same reference when nothing changed", () => {
    const r1 = record("1", "temp", 20);
    const existing = [block(["temp"], "d1", [r1])];
    const incomingSame = [block(["temp"], "d1", [record("1", "temp", 20)])];

    const result = mergeStrategy(existing, incomingSame);
    expect(result[0].result![0]).toBe(r1);
  });
});

describe("mergeStrategy with resource blocks", () => {
  it("keeps distinct resource types separate across updates (no key collision)", () => {
    const round1 = [
      resourceBlock("device", [{ id: "d1", name: "A" }]),
      resourceBlock("user", [{ id: "u1", name: "U" }]),
    ];
    const round2 = [
      resourceBlock("device", [{ id: "d1", name: "A2" }]),
      resourceBlock("user", [{ id: "u1", name: "U2" }]),
    ];

    const result = mergeStrategy(round1, round2);

    expect(result).toHaveLength(2);
    const device = result.find((b) => b.resource?.type === "device");
    const user = result.find((b) => b.resource?.type === "user");
    expect((device!.result![0] as { name: string }).name).toBe("A2");
    expect((user!.result![0] as { name: string }).name).toBe("U2");
  });

  it("replaces a resource block wholesale instead of record-merging", () => {
    const round1 = [resourceBlock("device", [{ id: "d1" }, { id: "d2" }])];
    const round2 = [resourceBlock("device", [{ id: "d3" }])];

    const result = mergeStrategy(round1, round2);

    expect(result).toHaveLength(1);
    expect(result[0].result).toBe(round2[0].result);
    expect(result[0].result).toHaveLength(1);
    expect((result[0].result![0] as { id: string }).id).toBe("d3");
  });

  it("keys same-type resource blocks by id so different ids don't collide", () => {
    const round1 = [resourceBlock("entity", [{ v: 1 }], { id: "a" }), resourceBlock("entity", [{ v: 2 }], { id: "b" })];
    const round2 = [resourceBlock("entity", [{ v: 3 }], { id: "a" })];

    const result = mergeStrategy(round1, round2);

    expect(result).toHaveLength(2);
    const entityA = result.find((b) => b.resource?.id === "a");
    const entityB = result.find((b) => b.resource?.id === "b");
    expect((entityA!.result![0] as { v: number }).v).toBe(3);
    expect((entityB!.result![0] as { v: number }).v).toBe(2);
  });

  it("merges data blocks and resource blocks independently", () => {
    const round1 = [block(["temp"], "d1", [record("1", "temp", 20)]), resourceBlock("device", [{ id: "dev1" }])];
    const round2 = [block(["temp"], "d1", [record("1", "temp", 25)]), resourceBlock("device", [{ id: "dev2" }])];

    const result = mergeStrategy(round1, round2);

    expect(result).toHaveLength(2);
    const data = result.find((b) => b.data);
    const resource = result.find((b) => b.resource);
    expect((data!.result![0] as TDataRecord).value).toBe(25);
    expect((resource!.result![0] as { id: string }).id).toBe("dev2");
  });
});

/**
 * Typing both fixtures as Required<TDataRecord> is what keeps the coverage honest: a field
 * added to the type fails typecheck until it is listed here, and the it.each below then
 * demands the compare notice it.
 */
const fullRecord: Required<TDataRecord> = {
  id: "1",
  variable: "dock_state",
  value: "dock-42",
  group: "group-a",
  device: "device-a",
  unit: "C",
  location: { type: "Point", coordinates: [-46.63, -23.55] },
  metadata: { color: "green", label: "free" },
  origin: "legacy-a",
  bucket: "bucket-a",
  time: "2024-01-01T00:00:00Z",
  created_at: "2024-01-01T00:00:01Z",
};

const editedRecord: Required<TDataRecord> = {
  id: "2",
  variable: "dock_state_v2",
  value: "dock-43",
  group: "group-b",
  device: "device-b",
  unit: "F",
  location: { type: "Point", coordinates: [-46.64, -23.56] },
  metadata: { color: "red", label: "occupied" },
  origin: "legacy-b",
  bucket: "bucket-b",
  time: "2024-01-02T00:00:00Z",
  created_at: "2024-01-02T00:00:01Z",
};

/** Fresh objects on every call, the way a structured-cloned realtime message arrives. */
const tick = (overrides: Partial<TDataRecord> = {}): TRealtimeData[] => [
  block(["dock_state"], "d1", [structuredClone({ ...fullRecord, ...overrides })]),
];

const firstRecord = (data: TRealtimeData[]): TDataRecord => (data[0].result as TDataRecord[])[0];

describe("mergeStrategy record comparison", () => {
  it("detects a metadata-only edit, which is what editDeviceData produces", () => {
    // A dock changing state edits metadata and nothing else: same record id, same value
    // (the dock id), untouched time. Comparing only the four scalars called this identical,
    // kept the stale object, and the painted output never changed.
    const existing = tick({ metadata: { color: "green", label: "free" } });
    const merged = mergeStrategy(existing, tick({ metadata: { color: "red", label: "occupied" } }));

    expect(merged).not.toBe(existing);
    expect(firstRecord(merged).metadata).toEqual({ color: "red", label: "occupied" });
  });

  it("detects a nested metadata edit, since metadata is an open-ended type", () => {
    const existing = tick({ metadata: { file: { url: "a.png", md5: "1", path: "/a" } } });
    const merged = mergeStrategy(existing, tick({ metadata: { file: { url: "b.png", md5: "2", path: "/b" } } }));

    expect(merged).not.toBe(existing);
    expect(firstRecord(merged).metadata?.file?.url).toBe("b.png");
  });

  it("detects an edit inside a metadata array", () => {
    const existing = tick({ metadata: { sentValues: [{ label: "on", value: 1 }] } });
    const merged = mergeStrategy(existing, tick({ metadata: { sentValues: [{ label: "on", value: 2 }] } }));

    expect(merged).not.toBe(existing);
  });

  it("detects a location-only change, so a map pin can move", () => {
    const existing = tick();
    const moved: TDataRecord["location"] = { type: "Point", coordinates: [-46.64, -23.56] };
    const merged = mergeStrategy(existing, tick({ location: moved }));

    expect(merged).not.toBe(existing);
    expect(firstRecord(merged).location).toEqual(moved);
  });

  it.each(Object.keys(fullRecord) as Array<keyof TDataRecord>)("detects an edit to %s", (field) => {
    const existing = tick();
    const merged = mergeStrategy(existing, tick({ [field]: editedRecord[field] }));

    expect(merged).not.toBe(existing);
  });

  it("keeps the existing reference when an identical tick arrives", () => {
    // The guard against the opposite bug. Every tick is a fresh clone, so a compare that
    // looked at references would report a change forever and re-render on every message.
    const existing = tick();
    const original = firstRecord(existing);
    const merged = mergeStrategy(existing, tick());

    expect(merged).toBe(existing);
    expect(firstRecord(merged)).toBe(original);
  });

  it("keeps the existing reference when metadata keys arrive in a different order", () => {
    // Key order is not meaning, which is why this cannot be implemented with JSON.stringify.
    const existing = tick({ metadata: { color: "green", unit: "C", label: "free" } });
    const merged = mergeStrategy(existing, tick({ metadata: { label: "free", color: "green", unit: "C" } }));

    expect(merged).toBe(existing);
  });

  it("keeps the existing reference when a metadata key arrives as an explicit undefined", () => {
    // The parent emits `old_value: undefined` for an empty cell, and JSON has no undefined,
    // so an absent key and an undefined one describe the same record.
    const existing = tick({ metadata: { label: "free" } });
    const merged = mergeStrategy(existing, tick({ metadata: { label: "free", old_value: undefined } }));

    expect(merged).toBe(existing);
  });

  it("keeps the existing reference for a lean record with no metadata and no location", () => {
    const lean = (): TRealtimeData[] => [block(["temp"], "d1", [record("1", "temp", 20)])];
    const existing = lean();

    expect(mergeStrategy(existing, lean())).toBe(existing);
  });

  it("still detects the plain value edit the old compare already handled", () => {
    const existing = tick({ value: 20 });
    const merged = mergeStrategy(existing, tick({ value: 25 }));

    expect(merged).not.toBe(existing);
    expect(firstRecord(merged).value).toBe(25);
  });

  it("counts a shape change as a change, since the record no longer describes the same thing", () => {
    const absent = tick({ metadata: undefined });
    expect(mergeStrategy(absent, tick({ metadata: undefined }))).toBe(absent);
    expect(mergeStrategy(absent, tick({ metadata: {} }))).not.toBe(absent);

    const tagged = tick({ metadata: { tags: ["a", "b"] } });
    expect(mergeStrategy(tagged, tick({ metadata: { tags: ["b", "a"] } }))).not.toBe(tagged);
  });
});
