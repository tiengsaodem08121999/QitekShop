"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { apiError } from "@/lib/apiError";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/Confirm";
import type { PaymentQr } from "@/types";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const PREVIEW_MS = 280;

function openPreview(
  qr: PaymentQr,
  setPreview: (qr: PaymentQr) => void,
  setPreviewShown: (shown: boolean) => void,
) {
  setPreview(qr);
  setPreviewShown(false);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => setPreviewShown(true));
  });
}

export default function PaymentQrManager() {
  const t = useT();
  const toast = useToast();
  const confirm = useConfirm();
  const [qrs, setQrs] = useState<PaymentQr[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PaymentQr | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [image, setImage] = useState("");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<PaymentQr | null>(null);
  const [previewShown, setPreviewShown] = useState(false);
  const previewWasShown = useRef(false);

  function closePreview() {
    setPreviewShown(false);
  }

  useEffect(() => {
    if (previewShown) {
      previewWasShown.current = true;
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [previewShown]);

  useEffect(() => {
    if (previewShown || !preview || !previewWasShown.current) return;
    const timer = setTimeout(() => {
      setPreview(null);
      previewWasShown.current = false;
    }, PREVIEW_MS);
    return () => clearTimeout(timer);
  }, [previewShown, preview]);

  useEffect(() => {
    if (!preview) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closePreview();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [preview]);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<PaymentQr[]>("/api/payment-qrs")
      .then(setQrs)
      .catch((err) => toast(apiError(err, t), "error"))
      .finally(() => setLoading(false));
  }, [toast, t.error]);

  useEffect(() => { load(); }, [load]);

  function startAdd() {
    setEditing(null);
    setName("");
    setNote("");
    setImage("");
    setAdding(true);
  }

  function startEdit(qr: PaymentQr) {
    setAdding(false);
    setEditing(qr);
    setName(qr.name);
    setNote(qr.note ?? "");
    setImage(qr.image);
  }

  function cancel() {
    setAdding(false);
    setEditing(null);
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      toast(t.settings_logo_too_large, "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImage(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  }

  async function save() {
    setSaving(true);
    try {
      const body = JSON.stringify({ name, note: note || null, image });
      if (editing) {
        await apiFetch(`/api/payment-qrs/${editing.id}`, { method: "PUT", body });
      } else {
        await apiFetch("/api/payment-qrs", { method: "POST", body });
      }
      cancel();
      load();
    } catch (err) {
      toast(apiError(err, t), "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(qr: PaymentQr) {
    if (!(await confirm(t.payment_qr_delete_confirm(qr.name)))) return;
    try {
      await apiFetch(`/api/payment-qrs/${qr.id}`, { method: "DELETE" });
      load();
    } catch (err) {
      toast(apiError(err, t), "error");
    }
  }

  const formOpen = adding || editing !== null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">{t.payment_qr_section}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{t.payment_qr_section_hint}</p>
        </div>
        {!formOpen && (
          <button onClick={startAdd}
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 shrink-0">
            {t.payment_qr_create}
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-gray-500">{t.loading}</p>}

      {!loading && qrs.length === 0 && !formOpen && (
        <p className="text-sm text-gray-500">{t.payment_qr_empty}</p>
      )}

      {!loading && qrs.length > 0 && (
        <ul className="space-y-3 mb-3">
          {qrs.map((qr) => (
            <li key={qr.id} className="flex items-center gap-4 text-sm border border-gray-100 rounded-lg p-3">
              <button
                type="button"
                onClick={() => openPreview(qr, setPreview, setPreviewShown)}
                title={t.payment_qr_view_large}
                className="shrink-0 rounded border bg-gray-50 p-1 hover:ring-2 hover:ring-blue-400 transition-all duration-200 hover:scale-105 active:scale-95 cursor-zoom-in"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr.image} alt={qr.name} className="h-16 w-16 object-contain" />
              </button>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-800">{qr.name}</div>
                {qr.note && <div className="text-gray-500 text-xs mt-0.5 truncate">{qr.note}</div>}
              </div>
              <button onClick={() => startEdit(qr)}
                className="text-gray-500 hover:text-gray-800 shrink-0">{t.edit}</button>
              <button onClick={() => remove(qr)}
                className="text-red-500 hover:text-red-700 shrink-0">{t.delete}</button>
            </li>
          ))}
        </ul>
      )}

      {formOpen && (
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1">{t.payment_qr_name}</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="border rounded px-3 py-2 w-full text-sm" placeholder={t.payment_qr_name_placeholder} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">{t.payment_qr_note}</label>
            <input value={note} onChange={(e) => setNote(e.target.value)}
              className="border rounded px-3 py-2 w-full text-sm" placeholder={t.payment_qr_note_placeholder} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">{t.payment_qr_image}</label>
            <div className="flex items-center gap-3 flex-wrap">
              {image ? (
                <button
                  type="button"
                  onClick={() => openPreview({ id: 0, name, image, note: note || null }, setPreview, setPreviewShown)}
                  title={t.payment_qr_view_large}
                  className="rounded border bg-gray-50 p-1 hover:ring-2 hover:ring-blue-400 transition-all duration-200 hover:scale-105 active:scale-95 cursor-zoom-in"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image} alt="qr" className="h-20 w-20 object-contain" />
                </button>
              ) : (
                <div className="h-20 w-20 flex items-center justify-center border border-dashed rounded text-xs text-gray-400">—</div>
              )}
              <label className="cursor-pointer border rounded px-3 py-2 text-sm hover:bg-gray-50">
                {t.payment_qr_upload}
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
              {image && (
                <button type="button" onClick={() => setImage("")}
                  className="text-sm text-red-600 hover:underline">{t.payment_qr_remove}</button>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving || !name || !image}
              className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? t.saving : t.save}
            </button>
            <button onClick={cancel}
              className="border px-4 py-1.5 rounded text-sm">{t.cancel}</button>
          </div>
        </div>
      )}

      {preview && (
        <div
          className={`fixed inset-0 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-out ${
            previewShown ? "bg-black/60 opacity-100" : "bg-black/0 opacity-0"
          }`}
          onClick={closePreview}
        >
          <div
            className={`bg-white rounded-xl shadow-xl p-6 max-w-sm w-full text-center origin-center transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform ${
              previewShown ? "scale-100 opacity-100 translate-y-0" : "scale-90 opacity-0 translate-y-3"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.image}
              alt={preview.name}
              className={`w-64 h-64 mx-auto object-contain transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                previewShown ? "scale-100" : "scale-95"
              }`}
            />
            <div
              className={`mt-4 font-semibold text-gray-800 transition-all duration-300 delay-75 ${
                previewShown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
              }`}
            >
              {preview.name}
            </div>
            {preview.note && (
              <div
                className={`mt-1 text-sm text-gray-500 transition-all duration-300 delay-100 ${
                  previewShown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                }`}
              >
                {preview.note}
              </div>
            )}
            <button
              type="button"
              onClick={closePreview}
              className={`mt-4 border px-4 py-2 rounded text-sm hover:bg-gray-50 transition-all duration-300 delay-150 ${
                previewShown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
              }`}
            >
              {t.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
