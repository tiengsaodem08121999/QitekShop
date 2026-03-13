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
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold">{q.customer.name}</h1>
          <span className={`text-xs px-2 py-1 rounded-full ${q.status === "confirmed" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
            {q.status === "confirmed" ? t.status_confirmed : t.status_draft}
          </span>
        </div>
        <div className="flex gap-2">
          {q.status === "draft" && (
            <>
              <button onClick={() => router.push(`/quotations/${id}/edit`)} className="border px-3 py-2 rounded text-sm hover:bg-gray-50">{t.edit}</button>
              <button onClick={handleConfirm} className="bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700">{t.confirm}</button>
              <button onClick={handleDelete} className="border border-red-300 text-red-600 px-3 py-2 rounded text-sm hover:bg-red-50">{t.delete}</button>
            </>
          )}
          <button onClick={handleExportPDF} className="bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700">{t.quotation_export_pdf}</button>
        </div>
      </div>

      <div className="font-semibold mb-2">{t.quotation_products}</div>
      <table className="w-full text-sm mb-6">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-4 py-2 text-left font-semibold">{t.quotation_col_name}</th>
            <th className="px-3 py-2 text-left font-semibold">{t.quotation_col_cond}</th>
            <th className="px-3 py-2 text-right font-semibold">{t.quotation_col_cost}</th>
            <th className="px-3 py-2 text-right font-semibold">{t.quotation_col_price}</th>
            <th className="px-3 py-2 font-semibold">{t.quotation_col_warranty}</th>
            <th className="px-3 py-2 font-semibold">{t.quotation_col_warranty_date}</th>
            <th className="px-3 py-2 font-semibold">{t.quotation_col_notes}</th>
          </tr>
        </thead>
        <tbody>
          {products.map((item, i) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="px-4 py-2">{item.name}</td>
              <td className="px-3 py-2">{item.condition}</td>
              <td className="px-3 py-2 text-right">{item.purchase_price.toLocaleString()}</td>
              <td className="px-3 py-2 text-right">{item.selling_price.toLocaleString()}</td>
              <td className="px-3 py-2">{item.warranty}</td>
              <td className="px-3 py-2">{item.warranty_start}</td>
              <td className="px-3 py-2 text-gray-500">{item.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid grid-cols-2 gap-6">
        {tradeIns.length > 0 && (
          <div>
            <div className="font-semibold mb-2">{t.quotation_trade_ins}</div>
            <table className="w-full text-sm">
              <tbody>
                {tradeIns.map((item, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2">{item.name}</td>
                    <td className="py-2 text-right">{item.purchase_price.toLocaleString()}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-2">{t.quotation_total_trade_in}</td>
                  <td className="py-2 text-right">{q.total_trade_in.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <div>
          <div className="font-semibold mb-2">{t.quotation_summary}</div>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b"><td className="py-2">{t.quotation_total_cost}</td><td className="py-2 text-right">{q.total_purchase.toLocaleString()}</td></tr>
              <tr className="border-b"><td className="py-2 font-semibold">{t.quotation_total_selling}</td><td className="py-2 text-right font-semibold">{q.total_amount.toLocaleString()}</td></tr>
              <tr className="border-b"><td className="py-2">{t.quotation_paid}</td><td className="py-2 text-right">{q.total_paid.toLocaleString()}</td></tr>
              {q.total_trade_in > 0 && <tr className="border-b"><td className="py-2">{t.quotation_trade_in}</td><td className="py-2 text-right">{q.total_trade_in.toLocaleString()}</td></tr>}
              <tr className="border-b bg-red-50"><td className="py-2 font-semibold">{t.quotation_remaining}</td><td className={`py-2 text-right font-semibold ${q.remaining > 0 ? "text-red-600" : "text-green-600"}`}>{q.remaining.toLocaleString()}</td></tr>
              <tr><td className="py-2">{t.quotation_profit}</td><td className="py-2 text-right text-green-600">{q.profit.toLocaleString()}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
