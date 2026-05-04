"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { trimSeconds, withSeconds } from "@/lib/schedule";
import type { EventStatus, ScheduleEvent, ScheduleTag } from "@/types";

interface Props {
  tags: ScheduleTag[];
  initial?: ScheduleEvent | null;
  defaultDate?: string;       // YYYY-MM-DD
  defaultStart?: string;      // HH:MM
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}

const STATUSES: EventStatus[] = ["pending", "in_progress", "done", "cancelled"];

export default function EventModal({
  tags, initial, defaultDate, defaultStart, onClose, onSaved, onDeleted,
}: Props) {
  const t = useT();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState(initial?.date ?? defaultDate ?? new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState(
    initial ? trimSeconds(initial.start_time) : defaultStart ?? "09:00"
  );
  const [endTime, setEndTime] = useState(
    initial ? trimSeconds(initial.end_time) : defaultStart
      ? `${String(Math.min(23, Number(defaultStart.slice(0, 2)) + 1)).padStart(2, "0")}:${defaultStart.slice(3)}`
      : "10:00"
  );
  const [status, setStatus] = useState<EventStatus>(initial?.status ?? "pending");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [tagIds, setTagIds] = useState<number[]>(initial?.tags.map((tag) => tag.id) ?? []);
  const [saving, setSaving] = useState(false);

  function toggleTag(id: number) {
    setTagIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (endTime <= startTime) {
      alert(t.error + ": end_time > start_time");
      return;
    }
    setSaving(true);
    try {
      const body = {
        title,
        date,
        start_time: withSeconds(startTime),
        end_time: withSeconds(endTime),
        status,
        description: description || null,
        tag_ids: tagIds,
      };
      if (initial) {
        await apiFetch(`/api/schedule/events/${initial.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch("/api/schedule/events", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      onSaved();
    } catch (err) {
      alert(err instanceof Error ? err.message : t.error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!initial || !confirm(t.schedule_delete_confirm)) return;
    try {
      await apiFetch(`/api/schedule/events/${initial.id}`, { method: "DELETE" });
      onDeleted?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : t.error);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4">
          {initial ? t.schedule_modal_edit : t.schedule_modal_add}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">{t.schedule_field_title}</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              className="border rounded px-3 py-2 w-full text-sm" required />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">{t.schedule_field_date}</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="border rounded px-3 py-2 w-full text-sm" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t.schedule_field_start}</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                className="border rounded px-3 py-2 w-full text-sm" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t.schedule_field_end}</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                className="border rounded px-3 py-2 w-full text-sm" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t.schedule_field_status}</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as EventStatus)}
              className="border rounded px-3 py-2 w-full text-sm">
              {STATUSES.map((s) => (
                <option key={s} value={s}>{t[`schedule_status_${s}` as keyof typeof t] as string}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t.schedule_field_description}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              className="border rounded px-3 py-2 w-full text-sm" rows={3} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t.schedule_field_tags}</label>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const active = tagIds.includes(tag.id);
                return (
                  <button type="button" key={tag.id} onClick={() => toggleTag(tag.id)}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      active ? "text-white" : "text-gray-700"
                    }`}
                    style={active ? { backgroundColor: tag.color, borderColor: tag.color } : { borderColor: tag.color }}>
                    {tag.name}
                  </button>
                );
              })}
              {tags.length === 0 && <p className="text-xs text-gray-500">{t.schedule_tag_empty}</p>}
            </div>
          </div>
          <div className="flex gap-3 pt-2 justify-between">
            <div className="flex gap-2">
              <button type="submit" disabled={saving}
                className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
                {saving ? t.saving : t.save}
              </button>
              <button type="button" onClick={onClose}
                className="border px-4 py-2 rounded text-sm">{t.cancel}</button>
            </div>
            {initial && (
              <button type="button" onClick={handleDelete}
                className="text-red-600 hover:text-red-800 text-sm">{t.delete}</button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
