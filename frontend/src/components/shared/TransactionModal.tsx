"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import type { Transaction, TransactionType } from "@/types";

interface Props {
  onClose: () => void;
  onSaved: () => void;
  initial?: Transaction;
}

export default function TransactionModal({ onClose, onSaved, initial }: Props) {
  const [date, setDate] = useState(initial?.date || new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState(initial?.description || "");
  const [type, setType] = useState<TransactionType>(initial?.type || "thu");
  const [amount, setAmount] = useState(initial?.amount || 0);
  const [notes, setNotes] = useState(initial?.notes || "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { date, description, type, amount, notes: notes || null };
      if (initial) {
        await apiFetch(`/api/finance/transactions/${initial.id}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await apiFetch("/api/finance/transactions", { method: "POST", body: JSON.stringify(body) });
      }
      onSaved();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4">{initial ? "Sửa giao dịch" : "Thêm giao dịch"}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Ngày</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border rounded px-3 py-2 w-full text-sm" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Danh mục *</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className="border rounded px-3 py-2 w-full text-sm" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Loại</label>
              <select value={type} onChange={(e) => setType(e.target.value as TransactionType)} className="border rounded px-3 py-2 w-full text-sm">
                <option value="thu">Thu</option>
                <option value="chi">Chi</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Số tiền *</label>
              <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="border rounded px-3 py-2 w-full text-sm" required min={1} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Ghi chú</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className="border rounded px-3 py-2 w-full text-sm" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
            <button type="button" onClick={onClose} className="border px-4 py-2 rounded text-sm">Hủy</button>
          </div>
        </form>
      </div>
    </div>
  );
}
