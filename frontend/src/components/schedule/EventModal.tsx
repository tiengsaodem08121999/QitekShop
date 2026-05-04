"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/Confirm";
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
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [h, m] = value.split(":");
  const cellCls =
    "appearance-none bg-transparent border-0 text-sm font-medium text-gray-800 cursor-pointer focus:outline-none text-center w-9 py-1";
  return (
    <div className="inline-flex items-center gap-1.5 border border-gray-300 rounded-md pl-3 pr-2 py-1.5 bg-white focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:border-blue-500 transition-colors">
      <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <select value={h} onChange={(e) => onChange(`${e.target.value}:${m}`)} className={cellCls} aria-label="hour">
        {HOURS.map((hh) => <option key={hh} value={hh}>{hh}</option>)}
      </select>
      <span className="text-gray-400 select-none">:</span>
      <select value={m} onChange={(e) => onChange(`${h}:${e.target.value}`)} className={cellCls} aria-label="minute">
        {MINUTES.map((mm) => <option key={mm} value={mm}>{mm}</option>)}
      </select>
    </div>
  );
}

export default function EventModal({
  tags, initial, defaultDate, defaultStart, onClose, onSaved, onDeleted,
}: Props) {
  const t = useT();
  const toast = useToast();
  const confirm = useConfirm();
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
      toast(`${t.schedule_field_end} > ${t.schedule_field_start}`, "error");
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
      toast(err instanceof Error ? err.message : t.error, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!initial) return;
    if (!(await confirm(t.schedule_delete_confirm))) return;
    try {
      await apiFetch(`/api/schedule/events/${initial.id}`, { method: "DELETE" });
      onDeleted?.();
    } catch (err) {
      toast(err instanceof Error ? err.message : t.error, "error");
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
              <TimeSelect value={startTime} onChange={setStartTime} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t.schedule_field_end}</label>
              <TimeSelect value={endTime} onChange={setEndTime} />
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
