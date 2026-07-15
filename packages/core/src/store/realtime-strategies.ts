import type { TDataRecord, TRealtimeData } from "../types/index.js";

/**
 * Replace strategy: swap the entire array with incoming data.
 * Best for "latest snapshot" widgets.
 */
export function replaceStrategy(_existing: TRealtimeData[], incoming: TRealtimeData[]): TRealtimeData[] {
  return incoming;
}

/**
 * Append strategy: concatenate incoming data, cap at maxRecords (FIFO).
 * Best for time-series widgets.
 */
export function appendStrategy(
  existing: TRealtimeData[],
  incoming: TRealtimeData[],
  maxRecords: number
): TRealtimeData[] {
  const combined = [...existing, ...incoming];
  if (combined.length <= maxRecords) return combined;
  return combined.slice(combined.length - maxRecords);
}

function recordsEqual(a: TDataRecord, b: TDataRecord): boolean {
  return a.id === b.id && a.value === b.value && a.time === b.time && a.variable === b.variable;
}

/**
 * Merge strategy: match by variable + origin, update existing records, append new ones.
 * Uses structural sharing -- only creates new TDataRecord objects for records that actually changed.
 */
export function mergeStrategy(existing: TRealtimeData[], incoming: TRealtimeData[]): TRealtimeData[] {
  if (existing.length === 0) return incoming;
  if (incoming.length === 0) return existing;

  const existingMap = new Map<string, TRealtimeData>();
  for (const block of existing) {
    const key = realtimeBlockKey(block);
    existingMap.set(key, block);
  }

  let changed = false;
  const result: TRealtimeData[] = [];
  const processedKeys = new Set<string>();

  for (const incomingBlock of incoming) {
    const key = realtimeBlockKey(incomingBlock);
    processedKeys.add(key);
    const existingBlock = existingMap.get(key);

    // Resource blocks are full snapshots: replace wholesale. They carry no id/time, so the
    // record-level merge (which matches by id and sorts by time) does not apply to them.
    if (incomingBlock.resource) {
      result.push(incomingBlock);
      if (incomingBlock !== existingBlock) changed = true;
      continue;
    }

    if (!existingBlock) {
      result.push(incomingBlock);
      changed = true;
      continue;
    }

    const mergedRecords = mergeRecords(
      (existingBlock.result ?? []) as TDataRecord[],
      (incomingBlock.result ?? []) as TDataRecord[]
    );
    const dataChanged = mergedRecords !== existingBlock.result;

    if (dataChanged) {
      result.push({ ...incomingBlock, result: mergedRecords });
      changed = true;
    } else {
      result.push(existingBlock);
    }
  }

  for (const [key, block] of existingMap) {
    if (!processedKeys.has(key)) {
      result.push(block);
    }
  }

  return changed || result.length !== existing.length ? result : existing;
}

function mergeRecords(existing: TDataRecord[], incoming: TDataRecord[]): TDataRecord[] {
  if (incoming.length === 0) return existing;

  const incomingById = new Map<string, TDataRecord>();
  for (const record of incoming) {
    incomingById.set(record.id, record);
  }

  let changed = false;
  const result: TDataRecord[] = [];

  for (const existingRecord of existing) {
    const incomingMatch = incomingById.get(existingRecord.id);
    if (incomingMatch) {
      if (recordsEqual(existingRecord, incomingMatch)) {
        result.push(existingRecord);
      } else {
        result.push(incomingMatch);
        changed = true;
      }
      incomingById.delete(existingRecord.id);
    } else {
      // Record no longer in incoming — it was deleted
      changed = true;
    }
  }

  for (const [, record] of incomingById) {
    result.push(record);
    changed = true;
  }

  if (changed) {
    result.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }

  return changed ? result : existing;
}

function realtimeBlockKey(block: TRealtimeData): string {
  if (block.resource) {
    const { type, id, index } = block.resource;
    return `resource:${type}:${id ?? ""}:${index ?? ""}`;
  }
  const vars = block.data?.variable?.join(",") ?? "";
  const origin = block.data?.origin ?? "";
  return `data:${vars}|${origin}`;
}

export type { TRealtimeData };
