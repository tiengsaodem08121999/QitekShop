"use client";

import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/api";

export default function SettingsPage() {
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
      alert(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout>
      <h1 className="text-xl font-bold mb-6">Cài đặt</h1>
      <div className="max-w-lg space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Tên cửa hàng</label>
          <input value={settings.shop_name || ""} onChange={(e) => update("shop_name", e.target.value)}
            className="border rounded px-3 py-2 w-full text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Địa chỉ</label>
          <input value={settings.shop_address || ""} onChange={(e) => update("shop_address", e.target.value)}
            className="border rounded px-3 py-2 w-full text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Số điện thoại</label>
          <input value={settings.shop_phone || ""} onChange={(e) => update("shop_phone", e.target.value)}
            className="border rounded px-3 py-2 w-full text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Tài khoản ban đầu (nghìn đồng)</label>
          <input type="number" value={settings.initial_balance || "0"} onChange={(e) => update("initial_balance", e.target.value)}
            className="border rounded px-3 py-2 w-full text-sm" />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleSave} disabled={saving}
            className="bg-blue-600 text-white px-6 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Đang lưu..." : "Lưu cài đặt"}
          </button>
          {saved && <span className="text-green-600 text-sm">Đã lưu!</span>}
        </div>
      </div>
    </AppLayout>
  );
}
