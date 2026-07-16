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
