import type { TDataRecordInput, TWidgetVariable } from "../types/index.js";

export function autoFillRecords(
  dataRecords: TDataRecordInput[] | undefined,
  widgetVariables: TWidgetVariable[] | undefined
): TDataRecordInput[] {
  if (!dataRecords || !widgetVariables) return [];

  const result: TDataRecordInput[] = [];

  for (const record of dataRecords) {
    for (const widgetVar of widgetVariables) {
      if (record.variable === widgetVar.variable) {
        result.push({
          device: widgetVar.origin.id,
          origin: widgetVar.origin.id,
          ...(widgetVar.origin.bucket && { bucket: widgetVar.origin.bucket }),
          ...record,
        });
      }
    }
  }

  return result;
}
