import type { TDataRecord } from "../types/index.js";

export function groupByDevice(records: TDataRecord[]): Record<string, TDataRecord[]> {
  const groups: Record<string, TDataRecord[]> = {};

  for (const record of records) {
    const key = record.device ?? record.origin ?? "unknown";
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(record);
  }

  return groups;
}
