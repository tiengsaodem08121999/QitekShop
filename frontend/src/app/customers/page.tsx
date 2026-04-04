"use client";

import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { Customer, PaginatedResponse } from "@/types";

export default function CustomersPage() {
  const t = useT();
  const [data, setData] = useState<PaginatedResponse<Customer> | null>(null);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | undefined>();

  function load() {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("limit", "100");
    apiFetch<PaginatedResponse<Customer>>(`/api/customers?${params}`).then(setData);
  }

  useEffect(() => { load(); }, [search]);

  const items = data?.items ?? [];

  return (
    <AppLayout>
      <div className="flex flex-col h-full overflow-hidden">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t.customers_title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t.customers_subtitle}</p>
        </div>
        <button onClick={() => { setEditCustomer(undefined); setShowModal(true); }}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          {t.customers_add}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col min-h-0 flex-1 mb-5">
        <div className="p-4 border-b border-gray-50 shrink-0">
          <div className="relative max-w-xs">
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input placeholder={t.customers_search} value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors" />
          </div>
        </div>
        <div className="overflow-auto flex-1" style={{ paddingBottom: 20 }}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
              <th className="px-5 py-3 font-medium">{t.customers_col_name}</th>
              <th className="px-4 py-3 font-medium">{t.customers_col_phone}</th>
              <th className="px-4 py-3 font-medium text-right">{t.customers_col_total_purchased}</th>
              <th className="px-4 py-3 font-medium">{t.customers_col_email}</th>
              <th className="px-4 py-3 font-medium">{t.customers_col_address}</th>
              <th className="px-4 py-3 font-medium">{t.customers_col_notes}</th>
              <th className="px-4 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                {t.customers_empty}
              </td></tr>
            )}
            {items.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50/70 transition-colors">
                <td className="px-5 py-3.5"><div className="font-medium text-gray-800">{c.name}</div></td>
                <td className="px-4 py-3.5 text-gray-600">{c.phone || t.dash}</td>
                <td className="px-4 py-3.5 text-right tabular-nums font-medium text-gray-700">{(c.total_purchased || 0).toLocaleString()}</td>
                <td className="px-4 py-3.5 text-gray-600">{c.email || t.dash}</td>
                <td className="px-4 py-3.5 text-gray-500 max-w-[200px] truncate">{c.address || t.dash}</td>
                <td className="px-4 py-3.5 text-gray-400 max-w-[150px] truncate">{c.notes || t.dash}</td>
                <td className="px-4 py-3.5">
                  <button onClick={() => { setEditCustomer(c); setShowModal(true); }}
                    className="p-1.5 rounded-md hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
      </div>

      {showModal && <CustomerModal t={t} initial={editCustomer} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />}
    </AppLayout>
  );
}

function CustomerModal({ t, initial, onClose, onSaved }: { t: ReturnType<typeof import("@/lib/i18n").useT>; initial?: Customer; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(initial?.name || "");
  const [phone, setPhone] = useState(initial?.phone || "");
  const [email, setEmail] = useState(initial?.email || "");
  const [address, setAddress] = useState(initial?.address || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { name, phone: phone || null, email: email || null, address: address || null, notes: notes || null };
      if (initial) {
        await apiFetch(`/api/customers/${initial.id}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await apiFetch("/api/customers", { method: "POST", body: JSON.stringify(body) });
      }
      onSaved();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : t.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4">{initial ? t.customers_modal_edit : t.customers_modal_add}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">{t.customers_name_required}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="border rounded px-3 py-2 w-full text-sm" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t.customers_col_phone}</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="border rounded px-3 py-2 w-full text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t.customers_col_email}</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="border rounded px-3 py-2 w-full text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t.customers_col_address}</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} className="border rounded px-3 py-2 w-full text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t.customers_col_notes}</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className="border rounded px-3 py-2 w-full text-sm" />
          </div>
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
