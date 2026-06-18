"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatNumber, parseNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { apiError } from "@/lib/apiError";
import { useAlert } from "@/components/Confirm";
import DateInput from "@/components/shared/DateInput";
import type {
  InventoryItem,
  PaginatedResponse,
  SoldItemInput,
  Transaction,
  TransactionType,
} from "@/types";

interface Props {
  onClose: () => void;
  onSaved: (txn: Transaction) => void;
  initial?: Transaction;
}

interface SoldRow {
  inventory_item_id: number;
  name: string;
  price: string; // formatted display string
}

export default function TransactionModal({ onClose, onSaved, initial }: Props) {
  const t = useT();
  const [date, setDate] = useState(initial?.date || new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState(initial?.description || "");
  const [type, setType] = useState<TransactionType>(initial?.type || "thu");
  const [amountDisplay, setAmountDisplay] = useState(initial?.amount ? formatNumber(initial.amount) : "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [saving, setSaving] = useState(false);
  const [available, setAvailable] = useState<InventoryItem[]>([]);
  const [soldRows, setSoldRows] = useState<SoldRow[]>(
    () =>
      (initial?.sold_items || []).map((s) => ({
        inventory_item_id: s.inventory_item_id,
        name: s.name,
        price: formatNumber(s.selling_price),
      }))
  );
  const notify = useAlert();

  useEffect(() => {
    if (type !== "thu") return;
    let active = true;
    apiFetch<PaginatedResponse<InventoryItem>>("/api/inventory?available=true")
      .then((res) => {
        if (active) setAvailable(res.items);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [type]);

  const selectedIds = new Set(soldRows.map((r) => r.inventory_item_id));
  const options = available.filter((i) => !selectedIds.has(i.id));

  function addItem(id: number) {
    const item = available.find((i) => i.id === id);
    if (!item) return;
    setSoldRows((prev) => [
      ...prev,
      {
        inventory_item_id: item.id,
        name: item.name,
        price: item.selling_price ? formatNumber(item.selling_price) : "",
      },
    ]);
  }

  function removeItem(id: number) {
    setSoldRows((prev) => prev.filter((r) => r.inventory_item_id !== id));
  }

  function setRowPrice(id: number, value: string) {
    setSoldRows((prev) =>
      prev.map((r) => (r.inventory_item_id === id ? { ...r, price: formatNumber(value) } : r))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const sold_items: SoldItemInput[] =
      type === "thu"
        ? soldRows.map((r) => ({ inventory_item_id: r.inventory_item_id, selling_price: parseNumber(r.price) }))
        : [];
    if (sold_items.some((s) => !s.selling_price || s.selling_price <= 0)) {
      notify(t.txn_sell_price);
      return;
    }
    setSaving(true);
    try {
      const body = {
        date,
        description,
        type,
        amount: parseNumber(amountDisplay),
        notes: notes || null,
        sold_items,
      };
      let txn: Transaction;
      if (initial) {
        txn = await apiFetch<Transaction>(`/api/finance/transactions/${initial.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        txn = await apiFetch<Transaction>("/api/finance/transactions", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      onSaved(txn);
    } catch (err: unknown) {
      notify(apiError(err, t));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4">{initial ? t.txn_modal_edit : t.txn_modal_add}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">{t.txn_date}</label>
            <DateInput value={date} onChange={setDate} className="border rounded px-3 py-2 w-full text-sm" required />
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

          {type === "thu" && (
            <div className="border rounded p-3 space-y-2">
              <label className="block text-sm font-medium">{t.txn_sell_section}</label>
              {soldRows.map((r) => (
                <div key={r.inventory_item_id} className="flex items-center gap-2">
                  <span className="flex-1 text-sm truncate">{r.name}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder={t.txn_sell_price}
                    value={r.price}
                    onChange={(e) => setRowPrice(r.inventory_item_id, e.target.value)}
                    className="border rounded px-2 py-1 w-32 text-sm text-right"
                  />
                  <button type="button" onClick={() => removeItem(r.inventory_item_id)} className="text-red-600 text-sm px-1">
                    {t.txn_sell_remove}
                  </button>
                </div>
              ))}
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) addItem(Number(e.target.value));
                }}
                className="border rounded px-3 py-2 w-full text-sm"
              >
                <option value="">{options.length ? t.txn_sell_add_item : t.txn_sell_no_items}</option>
                {options.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {type !== "thu" && (initial?.sold_items?.length ?? 0) > 0 && (
            <p className="text-sm text-amber-600">{t.txn_sell_switch_warning}</p>
          )}

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
