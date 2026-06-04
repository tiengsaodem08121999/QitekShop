"use client";

import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import ConfirmModal from "@/components/shared/ConfirmModal";
import { apiFetch } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { apiError } from "@/lib/apiError";
import { useToast } from "@/components/Toast";
import { useAlert } from "@/components/Confirm";
import { formatDate, formatNumber, parseNumber } from "@/lib/format";
import type { InventoryItem, InventoryStatus, PaginatedResponse } from "@/types";

const STATUS_STYLE: Record<InventoryStatus, string> = {
  in_stock: "bg-emerald-50 text-emerald-700",
  sold: "bg-red-50 text-red-600",
  returned: "bg-amber-50 text-amber-700",
};

function StatusBadge({ status }: { status: InventoryStatus }) {
  const t = useT();
  const label =
    status === "sold" ? t.inventory_status_sold
    : status === "returned" ? t.inventory_status_returned
    : t.inventory_status_in_stock;
  return <span className={`text-[11px] px-2 py-0.5 rounded font-semibold ${STATUS_STYLE[status]}`}>{label}</span>;
}

export default function InventoryPage() {
  const t = useT();
  const toast = useToast();
  const [data, setData] = useState<PaginatedResponse<InventoryItem> | null>(null);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | undefined>();
  const [deleteItem, setDeleteItem] = useState<InventoryItem | undefined>();
  const [deleting, setDeleting] = useState(false);

  function load() {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("limit", "200");
    apiFetch<PaginatedResponse<InventoryItem>>(`/api/inventory?${params}`)
      .then(setData)
      .catch((err) => toast(apiError(err, t), "error"));
  }

  useEffect(() => { load(); }, [search]);

  async function handleDelete() {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/inventory/${deleteItem.id}`, { method: "DELETE" });
      setDeleteItem(undefined);
      load();
    } catch (err) {
      toast(apiError(err, t), "error");
    } finally {
      setDeleting(false);
    }
  }

  const items = data?.items ?? [];

  return (
    <AppLayout>
      <div className="flex flex-col h-full overflow-hidden">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t.inventory_title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t.inventory_subtitle}</p>
        </div>
        <button onClick={() => { setEditItem(undefined); setShowModal(true); }}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          {t.inventory_add}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col min-h-0 flex-1 mb-5">
        <div className="p-4 border-b border-gray-50 shrink-0">
          <div className="relative max-w-xs">
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input placeholder={t.inventory_search} value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors" />
          </div>
        </div>
        <div className="overflow-auto flex-1" style={{ paddingBottom: 20 }}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
              <th className="px-5 py-3 font-medium">{t.inventory_col_name}</th>
              <th className="px-4 py-3 font-medium">{t.inventory_col_serial}</th>
              <th className="px-4 py-3 font-medium text-right">{t.inventory_col_purchase_price}</th>
              <th className="px-4 py-3 font-medium text-right">{t.inventory_col_selling_price}</th>
              <th className="px-4 py-3 font-medium">{t.inventory_col_supplier}</th>
              <th className="px-4 py-3 font-medium">{t.inventory_col_import_date}</th>
              <th className="px-4 py-3 font-medium">{t.inventory_col_status}</th>
              <th className="px-4 py-3 w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.length === 0 && (
              <tr><td colSpan={8} className="px-5 py-12 text-center text-gray-400">{t.inventory_empty}</td></tr>
            )}
            {items.map((it) => {
              return (
              <tr key={it.id} className="hover:bg-gray-50/70 transition-colors">
                <td className="px-5 py-3.5"><div className="font-medium text-gray-800">{it.name}</div></td>
                <td className="px-4 py-3.5 text-gray-600 font-mono">{it.serial_number || t.dash}</td>
                <td className="px-4 py-3.5 text-right tabular-nums text-gray-700">{(it.purchase_price || 0).toLocaleString()}</td>
                <td className="px-4 py-3.5 text-right tabular-nums font-medium text-gray-700">{it.selling_price != null ? it.selling_price.toLocaleString() : t.dash}</td>
                <td className="px-4 py-3.5 text-gray-500 max-w-[150px] truncate">{it.supplier || t.dash}</td>
                <td className="px-4 py-3.5 text-gray-600">{formatDate(it.created_at)}</td>
                <td className="px-4 py-3.5"><StatusBadge status={it.status} /></td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1">
                    <button onClick={() => { if (it.status !== "sold") { setEditItem(it); setShowModal(true); } }}
                      disabled={it.status === "sold"}
                      title={it.status === "sold" ? t.inventory_edit_blocked : t.edit}
                      className="p-1.5 rounded-md hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    <button onClick={() => { if (it.status !== "sold") setDeleteItem(it); }} disabled={it.status === "sold"}
                      title={it.status === "sold" ? t.inventory_delete_blocked : t.inventory_delete}
                      className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
      </div>

      {showModal && <InventoryModal t={t} initial={editItem} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />}
      {deleteItem && (
        <ConfirmModal title={t.inventory_delete_title}
          message={deleteItem.in_use ? t.inventory_delete_in_use : t.inventory_delete_prompt}
          confirmLabel={t.inventory_delete} cancelLabel={t.cancel} busy={deleting}
          onConfirm={handleDelete} onClose={() => setDeleteItem(undefined)} />
      )}
    </AppLayout>
  );
}

function InventoryModal({ t, initial, onClose, onSaved }: { t: ReturnType<typeof import("@/lib/i18n").useT>; initial?: InventoryItem; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(initial?.name || "");
  const [serial, setSerial] = useState(initial?.serial_number || "");
  const [purchasePrice, setPurchasePrice] = useState(initial ? formatNumber(initial.purchase_price) : "");
  const [sellingPrice, setSellingPrice] = useState(initial?.selling_price != null ? formatNumber(initial.selling_price) : "");
  const [supplier, setSupplier] = useState(initial?.supplier || "");
  const [status, setStatus] = useState<InventoryStatus>(initial?.status === "returned" ? "returned" : "in_stock");
  const [saving, setSaving] = useState(false);
  const notify = useAlert();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name,
        serial_number: serial || null,
        purchase_price: parseNumber(purchasePrice),
        selling_price: sellingPrice ? parseNumber(sellingPrice) : null,
        supplier: supplier || null,
      };
      if (initial) {
        if (initial.status !== "sold") body.status = status;
        await apiFetch(`/api/inventory/${initial.id}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await apiFetch("/api/inventory", { method: "POST", body: JSON.stringify(body) });
      }
      onSaved();
    } catch (err: unknown) {
      notify(apiError(err, t));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4">{initial ? t.inventory_modal_edit : t.inventory_modal_add}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">{t.inventory_name_required}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="border rounded px-3 py-2 w-full text-sm" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t.inventory_col_serial}{!initial && " *"}</label>
            <input value={serial} onChange={(e) => setSerial(e.target.value)} className="border rounded px-3 py-2 w-full text-sm" required={!initial} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">{t.inventory_col_purchase_price}</label>
              <input inputMode="numeric" value={purchasePrice} onChange={(e) => setPurchasePrice(formatNumber(e.target.value))} className="border rounded px-3 py-2 w-full text-sm text-right" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t.inventory_col_selling_price}</label>
              <input inputMode="numeric" value={sellingPrice} onChange={(e) => setSellingPrice(formatNumber(e.target.value))} className="border rounded px-3 py-2 w-full text-sm text-right" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t.inventory_col_supplier}</label>
            <input value={supplier} onChange={(e) => setSupplier(e.target.value)} className="border rounded px-3 py-2 w-full text-sm" />
          </div>
          {initial && initial.status !== "sold" && (
            <div>
              <label className="block text-sm font-medium mb-1">{t.inventory_col_status}</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as InventoryStatus)} className="border rounded px-3 py-2 w-full text-sm bg-white">
                <option value="in_stock">{t.inventory_status_in_stock}</option>
                <option value="returned">{t.inventory_status_returned}</option>
              </select>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? t.saving : t.save}
            </button>
            <button type="button" onClick={onClose} className="border px-4 py-2 rounded text-sm hover:bg-gray-50">{t.cancel}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
