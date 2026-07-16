/**
 * Read Resource Example
 *
 * Shows how to read platform resources (device list, users, entities, entity lists)
 * that the dashboard pushes to the widget through the realtime channel.
 * This is the React equivalent of the JavaScript "read-resource.html" example.
 *
 * A resource is a query over a platform collection: `filter` is the WHERE, `orderBy`
 * the ORDER BY, `amount` the LIMIT, and `view` picks the columns. So each group is
 * rendered as a query summary plus a table of the returned rows. Result columns are
 * data-driven (they come from the requested `view`), so rows are keyed dynamically.
 * For widget config / user info / blueprint devices, see "read-widget-info.tsx".
 */

import type { TJSONValue, TResourceFilter, TResourceGroup, TResourceType } from "@tago-io/custom-widget-react";
import { TagoIOProvider, useResourceData, useWidget } from "@tago-io/custom-widget-react";
import React from "react";

const TYPE_COLORS: Record<TResourceType, string> = {
  device: "#6366f1",
  user: "#8b5cf6",
  entity: "#f59e0b",
  entity_list: "#ef4444",
};

function formatCell(value: TJSONValue): string {
  if (value === null) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatFilter(filter: TResourceFilter): string {
  if (typeof filter === "string") return filter;
  if (Array.isArray(filter)) return filter.map((f) => `${f.key}=${f.value}`).join("  ·  ");

  return Object.entries(filter)
    .map(([key, value]) => `${key}=${formatCell(value)}`)
    .join("  ·  ");
}
function QueryBit({ label, value }: { label: string; value: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        gap: 6,
        alignItems: "baseline",
        padding: "3px 8px",
        borderRadius: 6,
        background: "#f1f5f9",
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          color: "#94a3b8",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 11,
          color: "#334155",
          fontFamily: "ui-monospace, monospace",
        }}
      >
        {value}
      </span>
    </span>
  );
}

function ResourceCard({ group }: { group: TResourceGroup }) {
  const { resource, result } = group;
  const color = TYPE_COLORS[resource.type] ?? "#64748b";
  const columns = Array.from(new Set(result.flatMap((item) => Object.keys(item))));

  const filterText =
    resource.filter !== undefined && !(Array.isArray(resource.filter) && resource.filter.length === 0)
      ? formatFilter(resource.filter)
      : null;
  const hasQuery = filterText !== null || !!resource.orderBy || resource.amount !== undefined || !!resource.index;

  return (
    <section
      style={{
        border: "1px solid #eef0f4",
        borderLeft: `3px solid ${color}`,
        borderRadius: 12,
        background: "#fff",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px",
          background: "#f7f8fa",
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 1,
            color,
          }}
        >
          {resource.type}
        </span>
        {resource.id && (
          <span
            style={{
              fontSize: 11,
              color: "#94a3b8",
              fontFamily: "ui-monospace, monospace",
            }}
          >
            {resource.id}
          </span>
        )}
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#94a3b8" }}>
          {result.length} item{result.length === 1 ? "" : "s"}
        </span>
      </div>

      {hasQuery && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            padding: "8px 14px",
            borderBottom: "1px solid #f1f5f9",
          }}
        >
          {filterText && <QueryBit label="filter" value={filterText} />}
          {resource.index && <QueryBit label="index" value={resource.index} />}
          {resource.orderBy && <QueryBit label="order" value={resource.orderBy} />}
          {resource.amount !== undefined && <QueryBit label="limit" value={String(resource.amount)} />}
        </div>
      )}

      {result.length === 0 ? (
        <p
          style={{
            margin: 0,
            padding: "16px 14px",
            fontSize: 13,
            fontStyle: "italic",
            color: "#9ca3af",
          }}
        >
          No items
        </p>
      ) : (
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
                      color: "#94a3b8",
                      borderBottom: "1px solid #eef0f4",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.map((item, index) => (
                <tr key={index} style={{ borderBottom: "1px solid #f5f7fa" }}>
                  {columns.map((col) => (
                    <td
                      key={col}
                      style={{
                        padding: "8px 14px",
                        color: "#1e293b",
                        fontFamily: "ui-monospace, monospace",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatCell(item[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ResourceViewer() {
  const { label, isLoading } = useWidget();
  const { resources, refresh, eventCount, lastUpdatedAt } = useResourceData();

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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{label || "Resources"}</h1>
        <span style={{ fontSize: 12, color: "#94a3b8" }}>
          updates: {eventCount}
          {lastUpdatedAt ? ` · last ${lastUpdatedAt.toLocaleTimeString()}` : ""}
        </span>
        <button
          type="button"
          onClick={refresh}
          style={{
            marginLeft: "auto",
            padding: "8px 14px",
            borderRadius: 8,
            border: "none",
            background: "#6366f1",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Refresh resources
        </button>
      </div>

      {resources.length === 0 ? (
        <p style={{ color: "#9ca3af" }}>No resources received yet.</p>
      ) : (
        resources.map((group, index) => (
          <ResourceCard key={`${group.resource.type}-${group.resource.id ?? index}`} group={group} />
        ))
      )}
    </div>
  );
}

function App() {
  return (
    <TagoIOProvider>
      <ResourceViewer />
    </TagoIOProvider>
  );
}

export default App;
