"use client";

import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import TagManager from "@/components/shared/TagManager";
import { apiFetch } from "@/lib/api";
import { useT } from "@/lib/i18n";

export default function SettingsPage() {
  const t = useT();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiFetch<Record<string, string>>("/api/settings").then(setSettings);
  }, []);

  function update(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await apiFetch("/api/settings", { method: "PUT", body: JSON.stringify(settings) });
      setSaved(true);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : t.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout>
      <h1 className="text-xl font-bold mb-6">{t.settings_title}</h1>
      <div className="max-w-2xl space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t.settings_shop_name}</label>
            <input value={settings.shop_name || ""} onChange={(e) => update("shop_name", e.target.value)}
              className="border rounded px-3 py-2 w-full text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t.settings_address}</label>
            <input value={settings.shop_address || ""} onChange={(e) => update("shop_address", e.target.value)}
              className="border rounded px-3 py-2 w-full text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t.settings_phone}</label>
            <input value={settings.shop_phone || ""} onChange={(e) => update("shop_phone", e.target.value)}
              className="border rounded px-3 py-2 w-full text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t.settings_initial_balance}</label>
            <input type="number" value={settings.initial_balance || "0"} onChange={(e) => update("initial_balance", e.target.value)}
              className="border rounded px-3 py-2 w-full text-sm" />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={saving}
              className="bg-blue-600 text-white px-6 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? t.saving : t.settings_save}
            </button>
            {saved && <span className="text-green-600 text-sm">{t.settings_saved}</span>}
          </div>
        </div>

        <TagManager />
      </div>
    </AppLayout>
  );
}
