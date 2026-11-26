/**
 * Edit and Delete Data Example
 *
 * Shows how to change and delete the data records a widget receives.
 * This is the React equivalent of the JavaScript "edit-delete-data.html" example.
 *
 * useRealtimeData gives the records, useEditData and useDeleteData send the changes,
 * and useWidgetErrors holds every error the host reports, including the ones a row
 * already shows.
 */

import type { TDataRecord } from "@tago-io/custom-widget-react";
import {
  TagoIOProvider,
  useDeleteData,
  useEditData,
  useRealtimeData,
  useWidget,
  useWidgetErrors,
} from "@tago-io/custom-widget-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

type TValue = NonNullable<TDataRecord["value"]>;
// staleValue is what realtime showed for the record when the save was sent.
type TSavedValue = { value: TValue; staleValue: TDataRecord["value"] };

// A refused edit or delete rejects with the dashboard's message. An older host, such as a
// TagoDeploy instance that has not been updated, may never answer, so stop waiting after a while.
const REPLY_TIMEOUT_MS = 10_000;

const buttonStyle = { fontSize: 16, padding: "8px 12px", margin: "4px 8px 4px 0", minHeight: 44 };

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timeoutId = 0;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = window.setTimeout(() => {
      const error = new Error(
        `No answer from TagoIO within ${REPLY_TIMEOUT_MS / 1000} seconds. The change may still go through.`
      );
      error.name = "TimeoutError";
      reject(error);
    }, REPLY_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

// Send the value with the type it had, so a numeric variable does not turn into text.
// Returns null when the text does not fit that type.
function parseValue(text: string, current: TDataRecord["value"]): TValue | null {
  const trimmed = text.trim();
  if (typeof current === "number") {
    return trimmed === "" || !Number.isFinite(Number(trimmed)) ? null : Number(trimmed);
  }
  if (typeof current === "boolean") {
    return trimmed === "true" ? true : trimmed === "false" ? false : null;
  }
  return text;
}

// Rejections are the host's plain { status, message } replies or the timeout's Error. A
// timeout leaves the outcome unknown, so it gets neither the failure style nor a
// "Not saved" or "Not deleted" label.
function failureStatus(label: string, error: unknown): { text: string; failed: boolean } {
  const { name, message } = (error ?? {}) as { name?: string; message?: string };
  const reason = message || "Unknown error";
  return name === "TimeoutError" ? { text: reason, failed: false } : { text: `${label}: ${reason}`, failed: true };
}

function App() {
  return (
    <TagoIOProvider>
      <RecordEditor />
    </TagoIOProvider>
  );
}

function RecordEditor() {
  const { isLoading } = useWidget();
  const { records } = useRealtimeData();
  const { lastError, clearErrors } = useWidgetErrors();
  // Changes TagoIO confirmed, applied on top of `records`: realtime may not bring the
  // change back, and a later push can still carry the old record. An entry is dropped as soon
  // as realtime shows any value other than its staleValue: the saved one, a newer change
  // made somewhere else, or the value of an earlier save from this row.
  const [savedValues, setSavedValues] = useState<Map<string, TSavedValue>>(() => new Map());
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  // The value realtime shows for each record, before any saved value is applied on top.
  const realtimeValues = useMemo(() => new Map(records.map((record) => [record.id, record.value])), [records]);
  // The same values in the latest render, read when a reply comes back.
  const latestValues = useRef(realtimeValues);

  // Once realtime moves a record off the value it had when the save was sent, stop overriding it.
  useEffect(() => {
    latestValues.current = realtimeValues;
    setSavedValues((saved) => {
      const pending = [...saved].filter(
        ([id, entry]) => realtimeValues.has(id) && realtimeValues.get(id) === entry.staleValue
      );
      return pending.length === saved.size ? saved : new Map(pending);
    });
    setDeletedIds((deleted) => {
      const pending = deleted.filter((id) => realtimeValues.has(id));
      return pending.length === deleted.length ? deleted : pending;
    });
  }, [realtimeValues]);

  if (isLoading) {
    return <p style={{ padding: 20 }}>Loading widget...</p>;
  }

  // Sort a copy: `records` belongs to the SDK store.
  const rows = records
    .filter((record) => !deletedIds.includes(record.id))
    .map((record) => {
      const saved = savedValues.get(record.id);
      return saved ? { ...record, value: saved.value } : record;
    })
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: 20 }}>
      <h1>Edit and delete data records</h1>
      <p>Change the value of a record or delete it. The rows are the records this widget receives from TagoIO.</p>

      {/* The only place that sees a failure sent without the request key, such as the
          "Failed to delete" of an older host, or one that comes after its row stopped waiting. */}
      {lastError && (
        <div style={{ color: "red", border: "1px solid red", padding: 10, margin: "10px 0" }}>
          Error: {lastError.message || "Unknown error"}{" "}
          <button type="button" onClick={clearErrors} style={buttonStyle}>
            Dismiss
          </button>
        </div>
      )}
      {notice && <p>{notice}</p>}

      <p style={{ background: "#f0f0f0", padding: 10 }}>
        {rows.length === 0 ? "No records yet." : `${rows.length} record${rows.length === 1 ? "" : "s"}`}
      </p>

      {rows.map((record) => (
        <RecordRow
          key={record.id}
          record={record}
          realtimeValue={realtimeValues.get(record.id)}
          onSaved={(value, before) => {
            // Show the saved value while realtime still shows the one from before the save.
            // Otherwise realtime already shows this save, or a newer change made somewhere else.
            const stillBefore = latestValues.current.get(record.id) === before;
            setSavedValues((saved) => {
              const next = new Map(saved);
              if (stillBefore) {
                next.set(record.id, { value, staleValue: before });
              } else {
                next.delete(record.id);
              }
              return next;
            });
          }}
          onDeleted={() => {
            setDeletedIds((deleted) => [...deleted, record.id]);
            setNotice(`Deleted ${record.variable} from ${new Date(record.time).toLocaleString()}.`);
          }}
        />
      ))}
    </div>
  );
}

function RecordRow({
  record,
  realtimeValue,
  onSaved,
  onDeleted,
}: {
  record: TDataRecord;
  // The value realtime shows for the record, before any saved value is applied on top.
  realtimeValue: TDataRecord["value"];
  onSaved: (value: TValue, before: TDataRecord["value"]) => void;
  onDeleted: () => void;
}) {
  const { variables } = useWidget();
  const { editData } = useEditData();
  const { deleteData } = useDeleteData();
  // null while the field shows the record's own value, so realtime updates reach it.
  const [draft, setDraft] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  // The hooks' isEditing and isDeleting stay true when no reply comes, so the row keeps
  // its own busy flag.
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; failed: boolean } | null>(null);

  const shownValue = record.value === undefined ? "" : String(record.value);

  async function save() {
    const value = parseValue(draft ?? shownValue, record.value);
    if (value === null) {
      setStatus({ text: typeof record.value === "number" ? "Enter a number." : "Enter true or false.", failed: true });
      return;
    }

    // useEditData makes one copy of an edit per device the variable is bound on. When a copy
    // goes to a device that does not hold the record, the platform refuses the call, and the
    // copies it handled before that one stay saved. The binding for the record's own device
    // sends every copy to the device that holds it.
    const binding = variables.find((item) => item.variable === record.variable && item.origin.id === record.device);
    if (!binding) {
      setStatus({ text: "Not saved: this record's device is not bound to the widget.", failed: true });
      return;
    }

    setBusy(true);
    setStatus({ text: "Saving...", failed: false });
    const before = realtimeValue;
    try {
      const address = { device: binding.origin.id, origin: binding.origin.id, bucket: binding.origin.bucket };
      await withTimeout(editData({ id: record.id, variable: record.variable, value, ...address }));
      onSaved(value, before);
      setDraft(null);
      setStatus({ text: "Saved.", failed: false });
    } catch (error) {
      setStatus(failureStatus("Not saved", error));
    }
    setBusy(false);
  }

  async function remove() {
    setConfirming(false);
    setBusy(true);
    setStatus({ text: "Deleting...", failed: false });
    try {
      // useDeleteData builds the "<record id>:<device id>" string from `id` and `device`.
      await withTimeout(deleteData(record));
      onDeleted();
    } catch (error) {
      setStatus(failureStatus("Not deleted", error));
      setBusy(false);
    }
  }

  return (
    <div style={{ border: "1px solid #ddd", padding: 10, margin: "10px 0" }}>
      <strong>{record.variable}</strong>
      <div style={{ color: "#555", fontSize: 13 }}>{new Date(record.time).toLocaleString()}</div>

      {confirming ? (
        <div>
          Delete this record?{" "}
          <button type="button" onClick={() => void remove()} style={buttonStyle}>
            Yes, delete
          </button>
          <button type="button" onClick={() => setConfirming(false)} style={buttonStyle}>
            Cancel
          </button>
        </div>
      ) : (
        // A form, so Enter in the field saves too.
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <input
            aria-label={`Value of ${record.variable}`}
            value={draft ?? shownValue}
            disabled={busy}
            onChange={(event) => setDraft(event.target.value)}
            style={{ width: 120, padding: 8, fontSize: 16 }}
          />{" "}
          {record.unit}{" "}
          <button type="submit" disabled={busy || draft === null} style={buttonStyle}>
            Save
          </button>
          <button type="button" disabled={busy} onClick={() => setConfirming(true)} style={buttonStyle}>
            Delete
          </button>
        </form>
      )}

      {status && <div style={{ color: status.failed ? "red" : "#555", fontSize: 13 }}>{status.text}</div>}
    </div>
  );
}

export default App;
