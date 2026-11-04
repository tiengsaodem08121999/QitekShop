"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { apiError } from "@/lib/apiError";
import { formatNumber, parseNumber } from "@/lib/format";
import { FULL_CASE_NAMES } from "@/lib/inventoryItemTypes";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/Toast";
import type { Buyback, BuybackItem } from "@/types";

const INPUT = "border border-gray-200 rounded-lg px-2.5 py-1.5 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed";

const EMPTY_LINE: BuybackItem = {
  name: "", serial_number: null, purchase_price: 0, expected_price: 0, selling_price: null,
  inventory_item_id: null, sold: false, locked: false,
};

function hasNoDetails(line: BuybackItem): boolean {
  return !line.serial_number && !line.purchase_price && !line.expected_price && line.inventory_item_id == null;
}

// Every saved line becomes stock, so a "Full case" row left as it was must not be saved.
function isUnusedTemplate(line: BuybackItem): boolean {
  return FULL_CASE_NAMES.includes(line.name.trim()) && hasNoDetails(line);
}

/** Create a buyback, or edit `initial`. */
export default function BuybackForm({ initial }: { initial?: Buyback }) {
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [lines, setLines] = useState<BuybackItem[]>(initial?.items ?? [{ ...EMPTY_LINE }]);
  const [saving, setSaving] = useState(false);

  function updateLine(index: number, patch: Partial<BuybackItem>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function addFullCase() {
    const rows = FULL_CASE_NAMES.map((name) => ({ ...EMPTY_LINE, name }));
    const untouched = lines.length === 1 && !lines[0].name.trim() && hasNoDetails(lines[0]);
    setLines(untouched ? rows : [...lines, ...rows]);
  }

  // Tab moves down the column, skipping locked cells; past the last row it leaves the column as usual.
  function handleTabDown(e: React.KeyboardEvent<HTMLInputElement>, row: number) {
    if (e.key !== "Tab" || e.shiftKey) return;
    const col = e.currentTarget.dataset.col;
    const cells = e.currentTarget.closest("table")?.querySelectorAll<HTMLInputElement>(`[data-col="${col}"]:not(:disabled)`);
    const next = Array.from(cells ?? []).find((cell) => Number(cell.dataset.row) > row);
    if (next) {
      e.preventDefault();
      next.focus();
      next.select();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const toSave = lines.filter((l) => l.name.trim() !== "" && !isUnusedTemplate(l));
    if (!title.trim()) return toast(t.err_buyback_title_required, "error");
    if (toSave.length === 0) return toast(t.err_buyback_no_items, "error");
    setSaving(true);
    try {
      await apiFetch(initial ? `/api/buybacks/${initial.id}` : "/api/buybacks", {
        method: initial ? "PUT" : "POST",
        body: JSON.stringify({ title, note: note || null, items: toSave }),
      });
      toast(initial ? t.toast_update_success : t.toast_create_success);
      router.push("/buybacks");
    } catch (err) {
      toast(apiError(err, t), "error");
      setSaving(false);
    }
  }

  const totalPurchase = lines.reduce((s, l) => s + l.purchase_price, 0);
  const totalExpected = lines.reduce((s, l) => s + l.expected_price, 0);
  const totalSold = lines.reduce((s, l) => s + (l.selling_price ?? 0), 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <label htmlFor="buyback-title" className="block text-sm font-medium text-gray-700 mb-2">{t.buyback_title_label}</label>
        <input id="buyback-title" value={title} maxLength={200} autoFocus onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex justify-between items-center px-5 py-3 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">{t.form_trade_ins}</h3>
          <div className="flex items-center gap-4">
            <button type="button" onClick={addFullCase}
              className="inline-flex items-center gap-1 text-gray-600 text-sm font-medium hover:text-gray-800 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
              {t.form_full_case}
            </button>
            <button type="button" onClick={() => setLines([...lines, { ...EMPTY_LINE }])}
              className="inline-flex items-center gap-1 text-blue-600 text-sm font-medium hover:text-blue-700 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              {t.form_add_trade_in}
            </button>
          </div>
        </div>
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr className="border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th className="w-[5%] px-2 py-2.5 text-center">{t.form_col_stt}</th>
              <th className="w-[29%] px-2 py-2.5 text-left">{t.quotation_col_name}</th>
              <th className="w-[15%] px-2 py-2.5 text-left">{t.form_col_serial}</th>
              <th className="w-[15%] px-2 py-2.5 text-left">{t.form_trade_in_price}</th>
              <th className="w-[15%] px-2 py-2.5 text-left">{t.inventory_col_expected_price}</th>
              <th className="w-[16%] px-2 py-2.5 text-right">{t.form_trade_in_resale_price}</th>
              <th className="w-[5%]"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {lines.map((line, i) => (
              <tr key={i} title={line.locked ? t.buyback_line_locked : undefined} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-2 py-2 text-center text-xs text-gray-400 tabular-nums">{i + 1}</td>
                <td className="px-2 py-2">
                  <input data-col="name" data-row={i} onKeyDown={(e) => handleTabDown(e, i)} aria-label={t.quotation_col_name} disabled={line.sold} value={line.name} maxLength={200} onChange={(e) => updateLine(i, { name: e.target.value })} className={INPUT} />
                </td>
                <td className="px-2 py-2">
                  <input data-col="serial" data-row={i} onKeyDown={(e) => handleTabDown(e, i)} aria-label={t.form_col_serial} disabled={line.sold} value={line.serial_number ?? ""} maxLength={100} onChange={(e) => updateLine(i, { serial_number: e.target.value || null })} className={`${INPUT} font-mono`} />
                </td>
                <td className="px-2 py-2">
                  <input data-col="purchase_price" data-row={i} onKeyDown={(e) => handleTabDown(e, i)} aria-label={t.form_trade_in_price} disabled={line.sold} type="text" inputMode="numeric" value={formatNumber(line.purchase_price)} onChange={(e) => updateLine(i, { purchase_price: parseNumber(e.target.value) })} className={`${INPUT} text-right`} />
                </td>
                <td className="px-2 py-2">
                  <input data-col="expected_price" data-row={i} onKeyDown={(e) => handleTabDown(e, i)} aria-label={t.inventory_col_expected_price} disabled={line.locked} type="text" inputMode="numeric" value={formatNumber(line.expected_price)} onChange={(e) => updateLine(i, { expected_price: parseNumber(e.target.value) })} className={`${INPUT} text-right`} />
                </td>
                <td className={`px-2 py-2 text-right tabular-nums ${line.selling_price != null ? "font-semibold text-emerald-600" : "text-gray-300"}`}>
                  {line.selling_price != null ? line.selling_price.toLocaleString() : "—"}
                </td>
                <td className="px-1 py-2 text-center">
                  {!line.locked && (
                    <button type="button" aria-label={t.delete} title={t.delete} onClick={() => setLines(lines.filter((_, j) => j !== i))}
                      className="p-1 rounded-md hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-6 text-center text-gray-400">{t.form_no_trade_ins}</td></tr>
            )}
          </tbody>
          <tfoot className="bg-gray-50">
            <tr className="border-t border-gray-200 font-bold text-gray-800">
              <td colSpan={3} className="px-5 py-3 text-right">{t.finance_sales_total}</td>
              <td className="px-4 py-3 text-right tabular-nums">{totalPurchase.toLocaleString()}</td>
              <td className="px-4 py-3 text-right tabular-nums">{totalExpected.toLocaleString()}</td>
              <td className="px-2 py-3 text-right tabular-nums">{totalSold.toLocaleString()}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <label htmlFor="buyback-note" className="block text-sm font-medium text-gray-700 mb-2">{t.quotation_note_label}</label>
        <textarea id="buyback-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors" />
      </div>

      <p className="text-xs text-gray-400">{t.buyback_stock_hint}</p>

      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm">
          {saving ? t.saving : initial ? t.form_update : t.form_create}
        </button>
        <button type="button" onClick={() => router.back()}
          className="border border-gray-200 px-4 py-2.5 rounded-lg text-sm hover:bg-gray-50 transition-colors">{t.cancel}</button>
      </div>
    </form>
  );
}
