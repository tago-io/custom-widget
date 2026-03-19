import type { TDataRecord } from "../types/index.js";

export function getLatestByVariable(records: TDataRecord[]): Record<string, TDataRecord> {
  const latest: Record<string, TDataRecord> = {};

  for (const record of records) {
    const existing = latest[record.variable];
    if (!existing || record.time > existing.time) {
      latest[record.variable] = record;
    }
  }

  return latest;
}
