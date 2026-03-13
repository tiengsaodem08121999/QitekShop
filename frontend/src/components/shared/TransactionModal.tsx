"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatNumber, parseNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { Transaction, TransactionType } from "@/types";

interface Props {
  onClose: () => void;
  onSaved: (txn: Transaction) => void;
  initial?: Transaction;
}

export default function TransactionModal({ onClose, onSaved, initial }: Props) {
  const t = useT();
  const [date, setDate] = useState(initial?.date || new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState(initial?.description || "");
  const [type, setType] = useState<TransactionType>(initial?.type || "thu");
  const [amountDisplay, setAmountDisplay] = useState(initial?.amount ? formatNumber(initial.amount) : "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { date, description, type, amount: parseNumber(amountDisplay), notes: notes || null };
      let txn: Transaction;
      if (initial) {
        txn = await apiFetch<Transaction>(`/api/finance/transactions/${initial.id}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        txn = await apiFetch<Transaction>("/api/finance/transactions", { method: "POST", body: JSON.stringify(body) });
      }
      onSaved(txn);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : t.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4">{initial ? t.txn_modal_edit : t.txn_modal_add}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">{t.txn_date}</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border rounded px-3 py-2 w-full text-sm" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t.txn_category}</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className="border rounded px-3 py-2 w-full text-sm" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">{t.txn_type}</label>
              <select value={type} onChange={(e) => setType(e.target.value as TransactionType)} className="border rounded px-3 py-2 w-full text-sm">
                <option value="thu">{t.txn_type_income}</option>
                <option value="chi">{t.txn_type_expense}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t.txn_amount}</label>
              <input type="text" inputMode="numeric" value={amountDisplay} onChange={(e) => setAmountDisplay(formatNumber(e.target.value))} className="border rounded px-3 py-2 w-full text-sm text-right" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t.txn_notes}</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className="border rounded px-3 py-2 w-full text-sm" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? t.saving : t.save}
            </button>
            <button type="button" onClick={onClose} className="border px-4 py-2 rounded text-sm">{t.cancel}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
