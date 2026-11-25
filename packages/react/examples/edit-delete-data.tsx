/**
 * Edit and Delete Data Example
 *
 * Shows how to change and delete the data records a widget receives.
 * This is the React equivalent of the JavaScript "edit-delete-data.html" example.
 *
 * useRealtimeData gives the records, useEditData and useDeleteData send the changes,
 * and useWidgetErrors holds the errors the host reports, including the ones that
 * arrive without a request key.
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
import React, { useEffect, useRef, useState } from "react";

type TValue = NonNullable<TDataRecord["value"]>;
// `stale` lists the values realtime showed for the record before the save.
type TSavedValue = { value: TValue; stale: TDataRecord["value"][] };

// When the platform API refuses an edit or a delete, the host never replies and the
// promise stays pending, so stop waiting after a while.
const REPLY_TIMEOUT_MS = 10_000;

const buttonStyle = { fontSize: 16, padding: "8px 12px", margin: "4px 8px 4px 0", minHeight: 44 };

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timeoutId = 0;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(`TagoIO did not confirm the change within ${REPLY_TIMEOUT_MS / 1000} seconds.`));
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

// Rejections are the host's plain { status, message } replies or the timeout's Error.
function errorText(error: unknown): string {
  return (error as { message?: string } | null)?.message || "Unknown error";
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
  // change back, and a later push can still carry the old record. An entry is dropped once
  // realtime shows a value that is not stale: the saved one, or a newer change made
  // somewhere else.
  const [savedValues, setSavedValues] = useState<Map<string, TSavedValue>>(() => new Map());
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  // The records of the latest render, read when a reply comes back.
  const latestRecords = useRef(records);

  // Once realtime shows a value that is not stale, stop overriding the record.
  useEffect(() => {
    latestRecords.current = records;
    const current = new Map(records.map((record) => [record.id, record.value]));
    setSavedValues((saved) => {
      const pending = [...saved].filter(([id, entry]) => current.has(id) && entry.stale.includes(current.get(id)));
      return pending.length === saved.size ? saved : new Map(pending);
    });
    setDeletedIds((deleted) => {
      const pending = deleted.filter((id) => current.has(id));
      return pending.length === deleted.length ? deleted : pending;
    });
  }, [records]);

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

      {/* The host reports some failures without the request key, so no promise settles for
          them. "Failed to delete" arrives only here. */}
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
          realtimeValue={records.find((item) => item.id === record.id)?.value}
          onSaved={(value, before) => {
            const shown = latestRecords.current.find((item) => item.id === record.id);
            setSavedValues((saved) => {
              // Realtime has not caught up while it shows the value from before this save, or
              // the value of an earlier save that is still waiting for realtime.
              const previous = saved.get(record.id);
              const stale = previous ? [...previous.stale, previous.value] : [before];
              const next = new Map(saved);
              if (shown && stale.includes(shown.value)) {
                next.set(record.id, { value, stale });
              } else {
                // Realtime already shows this save, or a newer change made somewhere else.
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

    setBusy(true);
    setStatus({ text: "Saving...", failed: false });
    const before = realtimeValue;
    try {
      // useEditData makes one copy of an edit per device the variable is bound on. When a copy
      // goes to a device that does not hold the record, the platform refuses the call, and the
      // copies it handled before that one stay saved. The binding for the record's own device
      // sends every copy to the device that holds it. Without one, the hook fills the record as
      // usual.
      const binding = variables.find((item) => item.variable === record.variable && item.origin.id === record.device);
      const address = binding
        ? { device: binding.origin.id, origin: binding.origin.id, bucket: binding.origin.bucket }
        : {};
      await withTimeout(editData({ id: record.id, variable: record.variable, value, ...address }));
      onSaved(value, before);
      setDraft(null);
      setStatus({ text: "Saved.", failed: false });
    } catch (error) {
      setStatus({ text: `Not saved: ${errorText(error)}`, failed: true });
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
      setStatus({ text: `Not deleted: ${errorText(error)}`, failed: true });
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
