import type { TDataRecord, TRealtimeData } from "../../src/types/index.js";
import { appendStrategy, mergeStrategy, replaceStrategy } from "../../src/store/realtime-strategies.js";

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
    const incoming = [block(["temp", "humidity"], "d1", [r1Updated])];

    const result = mergeStrategy(existing, incoming);
    expect(result[0].result![1]).toBe(r2);
    expect(result[0].result![0]).toBe(r1Updated);
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

  it("returns same reference when nothing changed", () => {
    const r1 = record("1", "temp", 20);
    const existing = [block(["temp"], "d1", [r1])];
    const incomingSame = [block(["temp"], "d1", [record("1", "temp", 20)])];

    const result = mergeStrategy(existing, incomingSame);
    expect(result[0].result![0]).toBe(r1);
  });
});
