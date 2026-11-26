/**
 * Format Data Example
 *
 * Shows how to group realtime records by device, pick the latest reading of each
 * variable, and format values and times in the viewer's language.
 * There is no JavaScript version: the JavaScript SDK exposes only window.TagoIO,
 * and these helpers are not part of it.
 *
 * groupByDevice, getLatestByVariable, groupByVariable, formatValue and formatDate are
 * core helpers that @tago-io/custom-widget-react re-exports. useRealtimeData gives the
 * records and useUserInformation the viewer's language and preferences.
 *
 * formatValue and formatDate read every convention from the locale. This example adds
 * the viewer's 12 or 24-hour clock (preferences.time_format) to it. Date order and the
 * decimal separator follow the language, not preferences.date_format or
 * preferences.decimal_separator. formatDate has no time zone option, so times show in
 * the browser's zone. To use preferences.timezone instead, pass it as timeZone to
 * Intl.DateTimeFormat yourself, except "system": that value means the browser's zone,
 * and Intl throws on it.
 */

import type { TDataRecord } from "@tago-io/custom-widget-react";
import {
  TagoIOProvider,
  formatDate,
  formatValue,
  getLatestByVariable,
  groupByDevice,
  groupByVariable,
  useRealtimeData,
  useUserInformation,
  useWidget,
} from "@tago-io/custom-widget-react";
import React from "react";

function App() {
  return (
    <TagoIOProvider>
      <LatestReadings />
    </TagoIOProvider>
  );
}

/** The viewer's language as an Intl locale tag that also carries their 12 or 24-hour clock. */
function viewerLocale(language: string | null, timeFormat: string | undefined): string | undefined {
  if (!language) return undefined;
  // formatDate has no hour12 option, but Intl reads the clock from the locale's "hc" extension.
  const hourCycle = timeFormat === "24" ? "h23" : timeFormat === "12" ? "h12" : undefined;
  try {
    // Intl throws on underscore tags such as "pt_BR", which some accounts store.
    return new Intl.Locale(language.replaceAll("_", "-"), { hourCycle }).toString();
  } catch {
    // Both helpers print unformatted values for a tag Intl rejects, so fall back to the browser's language.
    return undefined;
  }
}

function formatReading(record: TDataRecord, locale: string | undefined): string {
  const { value, unit } = record;
  // formatValue returns "" for a missing value but "0" for an empty string, since Number("") is 0.
  if (value === undefined || value === "") return "-";
  // Numbers and numeric strings get the locale's separators (a code such as "0042" prints as 42),
  // other strings pass through, and booleans print as "true" or "false" in every language.
  const text = formatValue(value, { locale, maximumFractionDigits: 2 });
  // Units are free text such as "°C" or "%", which Intl's style: "unit" rejects, so append them here.
  return unit ? `${text} ${unit}` : text;
}

function LatestReadings() {
  const { label, isLoading } = useWidget();
  const { records } = useRealtimeData();
  const { language, preferences } = useUserInformation();

  if (isLoading) {
    return <p style={{ padding: 20 }}>Loading widget...</p>;
  }

  // Do not wait for userInformation: it comes in a later message than the widget config.
  // Until it does, locale is undefined and Intl uses the browser's language.
  const locale = viewerLocale(language, preferences?.time_format);
  const devices = Object.entries(groupByDevice(records));

  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: 20 }}>
      <h1>{label || "Latest readings"}</h1>

      {devices.length === 0 ? (
        <p>No data received yet.</p>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {devices.map(([deviceId, deviceRecords]) => (
            <DeviceCard key={deviceId} deviceId={deviceId} records={deviceRecords} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}

function DeviceCard({ deviceId, records, locale }: { deviceId: string; records: TDataRecord[]; locale?: string }) {
  // Both helpers key by variable name alone. Called on every record at once, they would merge
  // same-named variables from different devices, so call them per device.
  const latest = getLatestByVariable(records);
  const readings = groupByVariable(records);
  // Sort by name so rows keep their place when a newer reading arrives.
  const rows = Object.values(latest).sort((a, b) => a.variable.localeCompare(b.variable));

  return (
    <section style={{ flex: "1 1 260px", border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
      {/* Records carry the device ID only. Device names come in a device resource block (see "read-resource.tsx"). */}
      <h2 style={{ margin: "0 0 8px", fontSize: 14, fontFamily: "monospace" }}>{deviceId}</h2>

      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {rows.map((record) => {
          const time = formatDate(record.time, { locale, dateStyle: "short", timeStyle: "short" });
          const count = readings[record.variable].length;
          return (
            <li key={record.variable} style={{ borderTop: "1px solid #eee", padding: "6px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span>{record.variable}</span>
                <strong style={{ fontSize: 18 }}>{formatReading(record, locale)}</strong>
              </div>
              <small style={{ color: "#555" }}>
                {time} · {count} {count === 1 ? "reading" : "readings"}
              </small>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default App;
