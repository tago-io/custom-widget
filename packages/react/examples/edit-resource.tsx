/**
 * Edit Resource Example
 *
 * Shows how to edit platform resource rows (devices, users, entities) from a
 * custom widget. Only columns listed in the resource's `editable` array can be
 * edited — the platform enforces this server-side.
 *
 * The edit payload identity key depends on the resource type:
 * - device -> { device: rowId, ...fields }
 * - user   -> { user: rowId, ...fields }
 * - entity -> { id: rowId, entity: resource.id, ...fields }
 * Entity_list rows cannot be edited through this API.
 *
 * Tag and parameter columns are addressed as `tags.<key>` / `param.<key>` in
 * `view`/`editable`, while rows carry `tags`/`params` as arrays of { key, value } —
 * so those columns are resolved from the array, and edits are sent with the
 * dotted key (e.g. { device, "tags.device_type": "sensor" }).
 *
 * Click an editable cell, type the new value, and press Enter to save (Escape
 * cancels). The save promise settles when the dashboard echoes the request key
 * back. For reading resources, see "read-resource.tsx".
 */

import type {
  TJSONValue,
  TResource,
  TResourceEditInput,
  TResourceGroup,
  TResourceRecord,
} from "@tago-io/custom-widget-react";
import { TagoIOProvider, useEditResourceData, useResourceData, useWidget } from "@tago-io/custom-widget-react";
import React, { useState } from "react";

function formatCell(value: TJSONValue | undefined): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function getRowId(row: TResourceRecord): string | null {
  if (typeof row.id === "string") return row.id;
  if (typeof row.id === "number") return String(row.id);
  return null;
}

/** Resolve a column value: `tags.X` / `param.X` come from the row's array, plain keys from the row. */
function getCellValue(row: TResourceRecord, column: string): TJSONValue {
  const dot = column.indexOf(".");
  if (dot > 0) {
    const prefix = column.slice(0, dot);
    const key = column.slice(dot + 1);
    const arrayKey = prefix === "param" ? "params" : prefix;
    const entries = row[arrayKey];
    if (Array.isArray(entries)) {
      const match = entries.find(
        (entry) => typeof entry === "object" && entry !== null && !Array.isArray(entry) && entry.key === key
      );
      if (match && typeof match === "object" && !Array.isArray(match)) return match.value ?? null;
    }
    return null;
  }
  return row[column] ?? null;
}

/** Row keys, replacing raw `tags`/`params` arrays with the dotted columns the view/editable declare. */
function buildColumns(resource: TResource, result: TResourceRecord[]): string[] {
  const dotted = Array.from(new Set([...(resource.view ?? []), ...(resource.editable ?? [])])).filter((column) =>
    column.includes(".")
  );
  const expandedPrefixes = new Set(
    dotted.map((column) => (column.startsWith("param.") ? "params" : column.slice(0, column.indexOf("."))))
  );
  const rowColumns = Array.from(new Set(result.flatMap((item) => Object.keys(item)))).filter(
    (column) => !expandedPrefixes.has(column)
  );
  return [...rowColumns, ...dotted.filter((column) => !rowColumns.includes(column))];
}

/** Entity fields keep their type: when the current cell holds a number and the draft parses, send a number. */
function coerceEntityValue(row: TResourceRecord, column: string, value: string): TJSONValue {
  const current = getCellValue(row, column);
  if (typeof current === "number" && value.trim() !== "") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return value;
}

function buildEditPayload(
  resource: TResource,
  row: TResourceRecord,
  column: string,
  value: string
): TResourceEditInput {
  const rowId = getRowId(row) ?? "";
  // Device and user values are always strings, like the native widgets send.
  if (resource.type === "device") return { device: rowId, [column]: value };
  if (resource.type === "user") return { user: rowId, [column]: value };
  return { id: rowId, entity: resource.id ?? "", [column]: coerceEntityValue(row, column, value) };
}

/** Editing needs a row identity; entity data rows also need the block id. Entity_list rows are not editable. */
function canEditRow(resource: TResource, row: TResourceRecord): boolean {
  if (resource.type === "entity_list") return false;
  if (getRowId(row) === null) return false;
  if (resource.type === "entity") return !!resource.id;
  return true;
}

function EditableCell({
  resource,
  row,
  column,
  onSaved,
}: {
  resource: TResource;
  row: TResourceRecord;
  column: string;
  onSaved: () => void;
}) {
  const { editResourceData, isEditing, error } = useEditResourceData();
  const [draft, setDraft] = useState<string | null>(null);

  const save = async () => {
    if (draft === null) return;
    // Settles when the dashboard echoes the request key back — hosts without
    // that echo leave the promise pending, so the input stays disabled.
    await editResourceData(buildEditPayload(resource, row, column, draft));
    setDraft(null);
    onSaved();
  };

  if (draft === null) {
    const current = formatCell(getCellValue(row, column));
    return (
      <td
        onClick={() => setDraft(current === "—" ? "" : current)}
        title="Click to edit"
        style={{ padding: "8px 14px", fontFamily: "ui-monospace, monospace", cursor: "pointer", color: "#1e293b" }}
      >
        {current} <span style={{ color: "#94a3b8" }}>✎</span>
      </td>
    );
  }

  return (
    <td style={{ padding: "4px 8px" }}>
      <input
        autoFocus
        disabled={isEditing}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") void save();
          if (event.key === "Escape") setDraft(null);
        }}
        style={{ width: "100%", padding: "4px 6px", fontSize: 12, boxSizing: "border-box" }}
      />
      {error && <span style={{ color: "#dc2626", fontSize: 10 }}>{error.message}</span>}
    </td>
  );
}

function ResourceEditCard({ group, onSaved }: { group: TResourceGroup; onSaved: () => void }) {
  const { resource, result } = group;
  const columns = buildColumns(resource, result);
  const editable = new Set(resource.editable ?? []);

  return (
    <section style={{ border: "1px solid #eef0f4", borderRadius: 12, background: "#fff", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#f7f8fa" }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#6366f1" }}>
          {resource.type}
        </span>
        <span style={{ fontSize: 11, color: "#94a3b8" }}>
          editable: {resource.editable?.length ? resource.editable.join(", ") : "none"}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#94a3b8" }}>
          {result.length} item{result.length === 1 ? "" : "s"}
        </span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  style={{
                    textAlign: "left",
                    padding: "8px 14px",
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    color: editable.has(col) ? "#6366f1" : "#94a3b8",
                    borderBottom: "1px solid #eef0f4",
                    whiteSpace: "nowrap",
                  }}
                >
                  {col}
                  {editable.has(col) ? " ✎" : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.map((row, index) => (
              <tr key={index} style={{ borderBottom: "1px solid #f5f7fa" }}>
                {columns.map((col) =>
                  editable.has(col) && canEditRow(resource, row) ? (
                    <EditableCell key={col} resource={resource} row={row} column={col} onSaved={onSaved} />
                  ) : (
                    <td
                      key={col}
                      style={{ padding: "8px 14px", fontFamily: "ui-monospace, monospace", color: "#64748b" }}
                    >
                      {formatCell(getCellValue(row, col))}
                    </td>
                  )
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ResourceEditor() {
  const { label, isLoading } = useWidget();
  // `refresh` lives here (one store subscription) and is passed down to cells.
  const { resources, refresh } = useResourceData();

  if (isLoading) {
    return <p style={{ padding: 20, fontFamily: "system-ui, sans-serif" }}>Loading widget...</p>;
  }

  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: 20,
        color: "#1e293b",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{label || "Edit Resources"}</h1>

      {resources.length === 0 ? (
        <p style={{ color: "#9ca3af" }}>No resources received yet.</p>
      ) : (
        resources.map((group, index) => (
          <ResourceEditCard
            key={`${group.resource.type}-${group.resource.id ?? index}`}
            group={group}
            onSaved={refresh}
          />
        ))
      )}
    </div>
  );
}

function App() {
  return (
    <TagoIOProvider>
      <ResourceEditor />
    </TagoIOProvider>
  );
}

export default App;
