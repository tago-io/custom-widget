/**
 * Apply the auto-fill logic for the data records to make sure they have the necessary data before submission.
 *
 * When `window.TagoIO.autoFill = true`, there's no need to pass `bucket` and `device` (formerly `origin`) in the
 * data record objects to be submitted. TagoIO will auto-fill those fields automatically.
 *
 * To have fine-grained control over the target `device` and `bucket`, set `window.TagoIO.autoFill = false` and
 * make sure the data records being submitted have at least `device` (for Immutable and Mutable devices).
 *
 * This function also makes sure that, when auto-fill is enabled, only records matching the variables on the
 * widget itself are submitted.
 *
 * @param dataRecords Data records to be submitted.
 * @param widgetVariables Widget's variables.
 *
 * @return Array of data records for submission according to the auto-fill logic.
 */
function autoFillRecords(
  dataRecords: TDataRecord[] | undefined,
  widgetVariables: TWidgetVariable[] | undefined
): TDataRecord[] {
  const autoFilledArray: TDataRecord[] = [];

  if (!dataRecords || !widgetVariables) {
    return [];
  }

  dataRecords.forEach((dataRecord) => {
    widgetVariables.forEach((widgetVar) => {
      if (dataRecord.variable === widgetVar.variable) {
        autoFilledArray.push({
          device: widgetVar.origin.id,
          origin: widgetVar.origin.id,
          ...(widgetVar.origin.bucket && { bucket: widgetVar.origin.bucket }),
          ...dataRecord,
        });
      }
    });
  });

  return autoFilledArray;
}

export { autoFillRecords };
