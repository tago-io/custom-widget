/**
 * Read Resource Example
 *
 * Shows how to read platform resources (device list, users, entities, entity lists)
 * that the dashboard pushes to the widget through the realtime channel.
 * This is the React equivalent of the JavaScript "read-resource.html" example.
 *
 * Resource blocks arrive on the realtime channel carrying a `resource` descriptor
 * instead of `data`. useResourceData() exposes only those blocks, grouped and typed.
 * For widget config / user info / blueprint devices, see "read-widget-info.tsx".
 */

import type { TResourceGroup } from "@tago-io/custom-widget-react";
import { TagoIOProvider, useResourceData, useWidget } from "@tago-io/custom-widget-react";
import React from "react";

function App() {
  return (
    <TagoIOProvider>
      <ResourceViewer />
    </TagoIOProvider>
  );
}

function formatValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (value === null || value === undefined) return String(value);
  return JSON.stringify(value);
}

function ResourceRequest({ resource }: { resource: TResourceGroup["resource"] }) {
  const rows: Array<[string, string]> = [];
  if (resource.id) rows.push(["id", resource.id]);
  if (resource.index) rows.push(["index", resource.index]);
  if (resource.view?.length) rows.push(["view", resource.view.join(", ")]);
  if (resource.editable?.length) rows.push(["editable", resource.editable.join(", ")]);
  if (resource.filter !== undefined) rows.push(["filter", formatValue(resource.filter)]);
  if (resource.amount !== undefined) rows.push(["amount", String(resource.amount)]);
  if (resource.orderBy) rows.push(["orderBy", resource.orderBy]);

  if (rows.length === 0) return null;

  return (
    <div style={{ fontSize: 13, color: "#555", marginBottom: 8 }}>
      {rows.map(([key, value]) => (
        <div key={key}>
          <strong>{key}:</strong> {value}
        </div>
      ))}
    </div>
  );
}

function ResourceGroupCard({ group, position }: { group: TResourceGroup; position: number }) {
  return (
    <section style={{ border: "1px solid #ddd", borderRadius: 4, marginBottom: 16 }}>
      <div style={{ padding: "8px 12px", background: "#f5f5f5", display: "flex", gap: 8 }}>
        <strong>Group #{position + 1}</strong>
        <span style={{ textTransform: "uppercase", fontSize: 12, color: "#8a4b9c" }}>{group.resource.type}</span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#777" }}>
          {group.result.length} item{group.result.length === 1 ? "" : "s"}
        </span>
      </div>
      <div style={{ padding: 12 }}>
        <ResourceRequest resource={group.resource} />
        {group.result.length === 0 ? (
          <p style={{ fontStyle: "italic", color: "#777" }}>No items</p>
        ) : (
          group.result.map((item, itemIndex) => (
            <div key={itemIndex} style={{ border: "1px solid #eee", borderRadius: 3, padding: 8, marginBottom: 6 }}>
              {Object.entries(item).map(([key, value]) => (
                <div key={key} style={{ fontSize: 13 }}>
                  <strong>{key}:</strong> {formatValue(value)}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function ResourceViewer() {
  const { isLoading } = useWidget();
  const { resources, eventCount } = useResourceData();

  if (isLoading) {
    return <p style={{ padding: 20 }}>Loading widget...</p>;
  }

  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: 20 }}>
      <h1>Resource Viewer</h1>
      <p style={{ background: "#f0f0f0", padding: 10 }}>Updates received: {eventCount}</p>

      {resources.length === 0 ? (
        <p>No resources received yet.</p>
      ) : (
        resources.map((group, position) => (
          <ResourceGroupCard
            key={`${group.resource.type}-${group.resource.id ?? position}`}
            group={group}
            position={position}
          />
        ))
      )}
    </div>
  );
}

export default App;
