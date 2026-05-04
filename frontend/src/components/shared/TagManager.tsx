"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/Confirm";
import type { ScheduleTag } from "@/types";

const DEFAULT_COLOR = "#3B82F6";

export default function TagManager() {
  const t = useT();
  const toast = useToast();
  const confirm = useConfirm();
  const [tags, setTags] = useState<ScheduleTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ScheduleTag | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    apiFetch<ScheduleTag[]>("/api/schedule/tags")
      .then(setTags)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function startAdd() {
    setEditing(null);
    setName("");
    setColor(DEFAULT_COLOR);
    setAdding(true);
  }

  function startEdit(tag: ScheduleTag) {
    setAdding(false);
    setEditing(tag);
    setName(tag.name);
    setColor(tag.color);
  }

  function cancel() {
    setAdding(false);
    setEditing(null);
  }

  async function save() {
    setSaving(true);
    try {
      const body = JSON.stringify({ name, color });
      if (editing) {
        await apiFetch(`/api/schedule/tags/${editing.id}`, { method: "PUT", body });
      } else {
        await apiFetch("/api/schedule/tags", { method: "POST", body });
      }
      cancel();
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : t.error, "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(tag: ScheduleTag) {
    if (!(await confirm(t.schedule_tag_delete_confirm(tag.name)))) return;
    try {
      await apiFetch(`/api/schedule/tags/${tag.id}`, { method: "DELETE" });
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : t.error, "error");
    }
  }

  const formOpen = adding || editing !== null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-800">{t.schedule_tag_section}</h2>
        {!formOpen && (
          <button onClick={startAdd}
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">
            {t.schedule_tag_create}
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-gray-500">{t.loading}</p>}

      {!loading && tags.length === 0 && !formOpen && (
        <p className="text-sm text-gray-500">{t.schedule_tag_empty}</p>
      )}

      {!loading && tags.length > 0 && (
        <ul className="space-y-2 mb-3">
          {tags.map((tag) => (
            <li key={tag.id} className="flex items-center gap-3 text-sm">
              <span className="inline-block w-4 h-4 rounded-full border border-gray-200"
                style={{ backgroundColor: tag.color }} />
              <span className="flex-1 text-gray-800">{tag.name}</span>
              <button onClick={() => startEdit(tag)}
                className="text-gray-500 hover:text-gray-800">{t.edit}</button>
              <button onClick={() => remove(tag)}
                className="text-red-500 hover:text-red-700">{t.delete}</button>
            </li>
          ))}
        </ul>
      )}

      {formOpen && (
        <div className="border-t border-gray-100 pt-3 space-y-2">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1">{t.schedule_tag_name}</label>
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="border rounded px-3 py-2 w-full text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{t.schedule_tag_color}</label>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
                className="h-9 w-12 border rounded" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving || !name}
              className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? t.saving : t.save}
            </button>
            <button onClick={cancel}
              className="border px-4 py-1.5 rounded text-sm">{t.cancel}</button>
          </div>
        </div>
      )}
    </div>
  );
}
