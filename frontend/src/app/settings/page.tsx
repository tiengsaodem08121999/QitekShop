"use client";

import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import PaymentQrManager from "@/components/settings/PaymentQrManager";
import TagManager from "@/components/shared/TagManager";
import { apiFetch } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { apiError } from "@/lib/apiError";
import { useToast } from "@/components/Toast";
import { useAlert } from "@/components/Confirm";

export default function SettingsPage() {
  const t = useT();
  const toast = useToast();
  const notify = useAlert();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiFetch<Record<string, string>>("/api/settings")
      .then(setSettings)
      .catch((err) => toast(apiError(err, t), "error"));
  }, [toast, t.error]);

  function update(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  const MAX_LOGO_BYTES = 10 * 1024 * 1024; // 10MB

  function handleImageUpload(key: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      toast(t.settings_logo_too_large, "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => update(key, typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await apiFetch("/api/settings", { method: "PUT", body: JSON.stringify(settings) });
      setSaved(true);
    } catch (err: unknown) {
      notify(apiError(err, t));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout>
      <h1 className="text-xl font-bold mb-6">{t.settings_title}</h1>
      <div className="max-w-5xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="space-y-6">
            <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h2 className="text-lg font-semibold text-gray-800">{t.settings_section_shop}</h2>
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
                <label className="block text-sm font-medium mb-1">{t.settings_email}</label>
                <input value={settings.shop_email || ""} onChange={(e) => update("shop_email", e.target.value)}
                  className="border rounded px-3 py-2 w-full text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t.settings_website}</label>
                <input value={settings.shop_website || ""} onChange={(e) => update("shop_website", e.target.value)}
                  className="border rounded px-3 py-2 w-full text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t.settings_slogan}</label>
                <input value={settings.shop_slogan || ""} onChange={(e) => update("shop_slogan", e.target.value)}
                  className="border rounded px-3 py-2 w-full text-sm" />
              </div>
            </section>

            <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h2 className="text-lg font-semibold text-gray-800">{t.settings_section_finance}</h2>
              <div>
                <label className="block text-sm font-medium mb-1">{t.settings_initial_balance}</label>
                <input type="number" value={settings.initial_balance || "0"} onChange={(e) => update("initial_balance", e.target.value)}
                  className="border rounded px-3 py-2 w-full text-sm" />
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h2 className="text-lg font-semibold text-gray-800">{t.settings_section_branding}</h2>
              <div>
                <label className="block text-sm font-medium mb-1">{t.settings_logo}</label>
                <div className="flex items-center gap-3 flex-wrap">
                  {settings.shop_logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={settings.shop_logo} alt="logo" className="h-12 w-auto max-w-[160px] object-contain border rounded bg-gray-50 p-1" />
                  ) : (
                    <div className="h-12 w-32 flex items-center justify-center border border-dashed rounded text-xs text-gray-400">—</div>
                  )}
                  <label className="cursor-pointer border rounded px-3 py-2 text-sm hover:bg-gray-50">
                    {t.settings_logo_upload}
                    <input type="file" accept="image/*" onChange={(e) => handleImageUpload("shop_logo", e)} className="hidden" />
                  </label>
                  {settings.shop_logo && (
                    <button type="button" onClick={() => update("shop_logo", "")}
                      className="text-sm text-red-600 hover:underline">{t.settings_logo_remove}</button>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t.settings_qr}</label>
                <div className="flex items-center gap-3 flex-wrap">
                  {settings.shop_qr ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={settings.shop_qr} alt="qr" className="h-16 w-16 object-contain border rounded bg-gray-50 p-1" />
                  ) : (
                    <div className="h-16 w-16 flex items-center justify-center border border-dashed rounded text-xs text-gray-400">—</div>
                  )}
                  <label className="cursor-pointer border rounded px-3 py-2 text-sm hover:bg-gray-50">
                    {t.settings_qr_upload}
                    <input type="file" accept="image/*" onChange={(e) => handleImageUpload("shop_qr", e)} className="hidden" />
                  </label>
                  {settings.shop_qr && (
                    <button type="button" onClick={() => update("shop_qr", "")}
                      className="text-sm text-red-600 hover:underline">{t.settings_qr_remove}</button>
                  )}
                </div>
              </div>
            </section>

            <PaymentQrManager />

            <TagManager />
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3 border-t border-gray-200 pt-4">
          <button onClick={handleSave} disabled={saving}
            className="bg-blue-600 text-white px-6 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
            {saving ? t.saving : t.settings_save}
          </button>
          {saved && <span className="text-green-600 text-sm">{t.settings_saved}</span>}
        </div>
      </div>
    </AppLayout>
  );
}
