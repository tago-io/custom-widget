import { autoFillRecords } from "./utils";

describe("autoFillRecords", () => {
  const mockWidgetVariables: TWidgetVariable[] = [
    {
      variable: "some_variable",
      origin: { id: "deviceId", bucket: "bucketId" },
    },
  ];

  const mockDataRecordsNoBucket: TDataRecord[] = [
    {
      id: "dataRecord1",
      variable: "some_variable",
      value: "Value #1",
      device: "recordDeviceId",
      time: "timestamp",
    },
    {
      id: "invalidDataRecordA",
      variable: "invalid_variable",
      time: "timestamp",
    },
    {
      id: "dataRecord2",
      variable: "some_variable",
      value: "Value #2",
      device: "recordDeviceId",
      time: "timestamp",
    },
    {
      id: "invalidDataRecordB",
      variable: "some_variableB",
      time: "timestamp",
    },
  ];

  const mockDataRecordsNoDevice: TDataRecord[] = [
    {
      id: "dataRecord1",
      variable: "some_variable",
      value: "Value #1",
      bucket: "recordBucketId",
      time: "timestamp",
    },
    {
      id: "invalidDataRecordA",
      variable: "invalid_variable",
      time: "timestamp",
    },
    {
      id: "dataRecord2",
      variable: "some_variable",
      value: "Value #2",
      bucket: "recordBucketId",
      time: "timestamp",
    },
    {
      id: "invalidDataRecordB",
      variable: "some_variableB",
      time: "timestamp",
    },
  ];

  const mockDataRecordsNoSource: TDataRecord[] = [
    {
      id: "dataRecord1",
      variable: "some_variable",
      value: "Value #1",
      time: "timestamp",
    },
    {
      id: "invalidDataRecordA",
      variable: "invalid_variable",
      time: "timestamp",
    },
    {
      id: "dataRecord2",
      variable: "some_variable",
      value: "Value #2",
      time: "timestamp",
    },
    {
      id: "invalidDataRecordB",
      variable: "some_variableB",
      time: "timestamp",
    },
  ];

  it("returns an empty array if both parameters are undefined", () => {
    const autoFilled = autoFillRecords(undefined, undefined);
    expect(autoFilled).toStrictEqual([]);
  });

  it("returns an empty array if widget variables are undefined", () => {
    const autoFilled = autoFillRecords(mockDataRecordsNoBucket, undefined);
    expect(autoFilled).toStrictEqual([]);
  });

  it("returns an empty array if data records are undefined", () => {
    const autoFilled = autoFillRecords(undefined, mockWidgetVariables);
    expect(autoFilled).toStrictEqual([]);
  });

  it("auto-fills missing bucket IDs for records with matching widget variables, not overwriting the records' device ID", () => {
    const autoFilled = autoFillRecords(mockDataRecordsNoBucket, mockWidgetVariables);
    expect(autoFilled).toStrictEqual([
      { ...mockDataRecordsNoBucket[0], origin: "deviceId", bucket: "bucketId" },
      { ...mockDataRecordsNoBucket[2], origin: "deviceId", bucket: "bucketId" },
    ]);
  });

  it("auto-fills missing device IDs for records with matching widget variables, not overwriting the records' bucket ID", () => {
    const autoFilled = autoFillRecords(mockDataRecordsNoDevice, mockWidgetVariables);
    expect(autoFilled).toStrictEqual([
      { ...mockDataRecordsNoDevice[0], device: "deviceId", origin: "deviceId" },
      { ...mockDataRecordsNoDevice[2], device: "deviceId", origin: "deviceId" },
    ]);
  });

  it("auto-fills missing bucket and device IDs for records with matching widget variables", () => {
    const autoFilled = autoFillRecords(mockDataRecordsNoSource, mockWidgetVariables);
    expect(autoFilled).toStrictEqual([
      { ...mockDataRecordsNoSource[0], device: "deviceId", origin: "deviceId", bucket: "bucketId" },
      { ...mockDataRecordsNoSource[2], device: "deviceId", origin: "deviceId", bucket: "bucketId" },
    ]);
  });
});
