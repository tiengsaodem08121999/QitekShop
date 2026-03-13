"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { Quotation } from "@/types";

export default function QuotationDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const t = useT();
  const [q, setQ] = useState<Quotation | null>(null);

  useEffect(() => {
    apiFetch<Quotation>(`/api/quotations/${id}`).then(setQ);
  }, [id]);

  async function handleConfirm() {
    if (!window.confirm(t.quotation_confirm_prompt)) return;
    const updated = await apiFetch<Quotation>(`/api/quotations/${id}/confirm`, { method: "PATCH" });
    setQ(updated);
  }

  async function handleExportPDF() {
    const token = localStorage.getItem("token");
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/quotations/${id}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quotation-${id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDelete() {
    if (!window.confirm(t.quotation_delete_prompt)) return;
    await apiFetch(`/api/quotations/${id}`, { method: "DELETE" });
    router.push("/quotations");
  }

  if (!q) return <AppLayout><p>{t.loading}</p></AppLayout>;

  const products = q.items.filter((i) => !i.is_trade_in);
  const tradeIns = q.items.filter((i) => i.is_trade_in);

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/quotations")}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-white hover:border-gray-300 transition-colors text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-800">{q.customer.name}</h1>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                q.status === "confirmed"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${q.status === "confirmed" ? "bg-emerald-400" : "bg-amber-400"}`}></span>
                {q.status === "confirmed" ? t.status_confirmed : t.status_draft}
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-0.5">#{q.id} &middot; {new Date(q.created_at).toLocaleDateString("vi-VN")}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {q.status === "draft" && (
            <>
              <button onClick={() => router.push(`/quotations/${id}/edit`)}
                className="inline-flex items-center gap-1.5 border border-gray-200 px-3.5 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors text-gray-700">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                {t.edit}
              </button>
              <button onClick={handleConfirm}
                className="inline-flex items-center gap-1.5 bg-emerald-600 text-white px-3.5 py-2 rounded-lg text-sm hover:bg-emerald-700 transition-colors shadow-sm">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                {t.confirm}
              </button>
              <button onClick={handleDelete}
                className="inline-flex items-center gap-1.5 border border-red-200 text-red-600 px-3.5 py-2 rounded-lg text-sm hover:bg-red-50 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                {t.delete}
              </button>
            </>
          )}
          <button onClick={handleExportPDF}
            className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-3.5 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors shadow-sm">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            {t.quotation_export_pdf}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">{t.quotation_total_selling}</p>
          <p className="text-xl font-bold text-gray-800 mt-1">{q.total_amount.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">{t.quotation_paid}</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{q.total_paid.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">{t.quotation_remaining}</p>
          <p className={`text-xl font-bold mt-1 ${q.remaining > 0 ? "text-red-600" : "text-emerald-600"}`}>{q.remaining.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">{t.quotation_profit}</p>
          <p className={`text-xl font-bold mt-1 ${q.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{q.profit.toLocaleString()}</p>
        </div>
      </div>

      {/* Products table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">{t.quotation_products}</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.quotation_col_name}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.quotation_col_cond}</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t.quotation_col_cost}</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t.quotation_col_price}</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{t.quotation_col_warranty}</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{t.quotation_col_warranty_date}</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{t.quotation_col_notes}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {products.map((item, i) => (
              <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-5 py-3 font-medium text-gray-800">{item.name}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                    item.condition === "new" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"
                  }`}>{item.condition}</span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-600">{item.purchase_price.toLocaleString()}</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-800">{item.selling_price.toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-500">{item.warranty}</td>
                <td className="px-4 py-3 text-gray-500">{item.warranty_start || t.dash}</td>
                <td className="px-4 py-3 text-gray-400">{item.notes || t.dash}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Trade-ins */}
        {tradeIns.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">{t.quotation_trade_ins}</h3>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-50">
                {tradeIns.map((item, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-800">{item.name}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-gray-700">{item.purchase_price.toLocaleString()}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50/80">
                  <td className="px-5 py-3 font-semibold text-gray-700">{t.quotation_total_trade_in}</td>
                  <td className="px-5 py-3 text-right font-bold tabular-nums text-gray-800">{q.total_trade_in.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Summary */}
        <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${tradeIns.length === 0 ? "col-span-2 max-w-md" : ""}`}>
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">{t.quotation_summary}</h3>
          </div>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-gray-50">
                <td className="px-5 py-3 text-gray-600">{t.quotation_total_cost}</td>
                <td className="px-5 py-3 text-right tabular-nums text-gray-700">{q.total_purchase.toLocaleString()}</td>
              </tr>
              <tr className="border-b border-gray-50 bg-blue-50/30">
                <td className="px-5 py-3 font-semibold text-gray-800">{t.quotation_total_selling}</td>
                <td className="px-5 py-3 text-right font-bold tabular-nums text-gray-800">{q.total_amount.toLocaleString()}</td>
              </tr>
              <tr className="border-b border-gray-50">
                <td className="px-5 py-3 text-gray-600">{t.quotation_paid}</td>
                <td className="px-5 py-3 text-right tabular-nums text-emerald-600">{q.total_paid.toLocaleString()}</td>
              </tr>
              {q.total_trade_in > 0 && (
                <tr className="border-b border-gray-50">
                  <td className="px-5 py-3 text-gray-600">{t.quotation_trade_in}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-gray-700">{q.total_trade_in.toLocaleString()}</td>
                </tr>
              )}
              <tr className="border-b border-gray-50 bg-red-50/50">
                <td className="px-5 py-3.5 font-semibold text-gray-800">{t.quotation_remaining}</td>
                <td className={`px-5 py-3.5 text-right font-bold tabular-nums text-lg ${q.remaining > 0 ? "text-red-600" : "text-emerald-600"}`}>{q.remaining.toLocaleString()}</td>
              </tr>
              <tr>
                <td className="px-5 py-3 text-gray-600">{t.quotation_profit}</td>
                <td className={`px-5 py-3 text-right font-semibold tabular-nums ${q.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{q.profit.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
