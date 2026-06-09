"use client";

import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { getNote, saveNote } from "@/lib/note";
import { useT } from "@/lib/i18n";
import { apiError } from "@/lib/apiError";
import { useToast } from "@/components/Toast";

export default function NotePage() {
  const t = useT();
  const toast = useToast();
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  useEffect(() => {
    getNote()
      .then((note) => {
        setContent(note.content ?? "");
        setLastSaved(note.updated_at);
      })
      .catch((err) => toast(apiError(err, t), "error"));
  }, [toast, t]);

  async function handleSave() {
    setSaving(true);
    try {
      const note = await saveNote(content);
      setLastSaved(note.updated_at);
      setDirty(false);
      toast(t.note_saved, "success");
    } catch (err: unknown) {
      toast(apiError(err, t), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">{t.note_title}</h1>
        <div className="flex items-center gap-3">
          {lastSaved && !dirty && (
            <span className="text-xs text-gray-500">
              {t.note_last_saved}: {new Date(lastSaved).toLocaleString()}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="bg-blue-600 text-white px-6 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? t.saving : t.save}
          </button>
        </div>
      </div>
      <textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          setDirty(true);
        }}
        placeholder={t.note_placeholder}
        className="w-full min-h-[60vh] resize-y border border-gray-200 rounded-xl p-4 text-sm font-mono leading-relaxed bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </AppLayout>
  );
}
