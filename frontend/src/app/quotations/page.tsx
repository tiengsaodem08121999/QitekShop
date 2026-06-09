"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { apiError } from "@/lib/apiError";
import { useToast } from "@/components/Toast";
import QuotationStatusBadge from "@/components/quotation/QuotationStatusBadge";
import Pagination from "@/components/shared/Pagination";
import { useConfirm } from "@/components/Confirm";
import type { PaginatedResponse, Quotation, QuotationListItem } from "@/types";

const PAGE_SIZE = 12;

export default function QuotationsPage() {
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState<PaginatedResponse<QuotationListItem> | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("limit", "0"); // load all quotations (no pagination cap)
    apiFetch<PaginatedResponse<QuotationListItem>>(`/api/quotations?${params}`)
      .then(setData)
      .catch((err) => toast(apiError(err, t), "error"));
  }, [toast, t.error]);

  // Reset to page 1 whenever the search term changes.
  useEffect(() => { setPage(1); }, [search]);

  async function handleCopy(quotationId: number) {
    try {
      const q = await apiFetch<Quotation>(`/api/quotations/${quotationId}`);
      sessionStorage.setItem("quotation_copy", JSON.stringify({
        customer: q.customer,
        items: q.items,
      }));
      router.push("/quotations/new?copy=1");
    } catch (err) {
      toast(apiError(err, t), "error");
    }
  }

  async function handleDelete(quotationId: number) {
    if (!(await confirm(t.quotation_delete_prompt))) return;
    try {
      await apiFetch(`/api/quotations/${quotationId}`, { method: "DELETE" });
      toast(t.quotation_delete_success);
      setData((prev) =>
        prev ? { ...prev, items: prev.items.filter((x) => x.id !== quotationId) } : prev,
      );
    } catch (err) {
      toast(apiError(err, t), "error");
    }
  }

  const items = data?.items ?? []; // ALL quotations — summary cards use this
  const filtered = search
    ? items.filter((q) => q.customer_name.toLowerCase().includes(search.toLowerCase()))
    : items;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages); // stay valid after deletes
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const totalAmount = items.reduce((s, q) => s + q.total_amount, 0);
  const totalPaid = items.reduce((s, q) => s + q.total_paid, 0);
  // Split positive (customer owes shop) and negative (shop owes back when trade-in is handed over)
  // so the two amounts don't net out and hide each other.
  const totalOutstanding = items.reduce((s, q) => s + Math.max(q.remaining, 0), 0);
  const totalOverpaid = items.reduce((s, q) => s + Math.max(-q.remaining, 0), 0);

  return (
    <AppLayout>
      <div className="flex flex-col h-full overflow-hidden">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t.quotations_title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t.quotations_subtitle}</p>
        </div>
        <Link href="/quotations/new"
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          {t.quotations_new}
        </Link>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-6 shrink-0">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">{t.quotations_total}</div>
              <div className="text-xl font-bold text-gray-800">{items.length}</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">{t.quotations_total_selling}</div>
              <div className="text-xl font-bold text-gray-800">{totalAmount.toLocaleString()}</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">{t.quotations_paid}</div>
              <div className="text-xl font-bold text-emerald-600">{totalPaid.toLocaleString()}</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">{t.quotations_outstanding}</div>
              <div className={`text-xl font-bold ${totalOutstanding > 0 ? "text-red-600" : "text-gray-800"}`}>{totalOutstanding.toLocaleString()}</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">{t.quotations_overpaid}</div>
              <div className={`text-xl font-bold ${totalOverpaid > 0 ? "text-amber-600" : "text-gray-800"}`}>{totalOverpaid.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col min-h-0 flex-1">
        <div className="flex gap-3 p-4 border-b border-gray-50 shrink-0">
          <div className="relative flex-1 max-w-xs">
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input placeholder={t.quotations_search} value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors" />
          </div>
        </div>
        <div className="overflow-auto flex-1" style={{ paddingBottom: 20 }}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
              <th className="px-5 py-3 font-medium">{t.quotations_col_customer}</th>
              <th className="px-4 py-3 font-medium text-right">{t.quotations_col_total}</th>
              <th className="px-4 py-3 font-medium text-right">{t.quotations_col_paid}</th>
              <th className="px-4 py-3 font-medium text-right">{t.quotations_col_outstanding}</th>
              <th className="px-4 py-3 font-medium text-right">{t.quotations_col_overpaid}</th>
              <th className="px-4 py-3 font-medium text-center">{t.quotations_col_active}</th>
              <th className="px-4 py-3 font-medium">{t.quotations_col_created}</th>
              <th className="px-2 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-5 py-12 text-center text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                {t.quotations_empty}
              </td></tr>
            )}
            {pageItems.map((q) => (
              <tr key={q.id} onClick={() => router.push(`/quotations/${q.id}`)} className="hover:bg-gray-50/70 cursor-pointer transition-colors">
                <td className="px-5 py-3.5">
                  <div className="font-medium text-gray-800 flex items-center gap-2">{q.customer_name}<QuotationStatusBadge status={q.status} /></div>
                  <div className="text-xs text-gray-400 mt-0.5">#{q.id}</div>
                </td>
                <td className="px-4 py-3.5 text-right font-medium tabular-nums text-gray-700">{q.total_amount.toLocaleString()}</td>
                <td className="px-4 py-3.5 text-right tabular-nums text-gray-600">{q.total_paid.toLocaleString()}</td>
                <td className={`px-4 py-3.5 text-right font-medium tabular-nums ${q.remaining > 0 ? "text-red-600" : "text-emerald-600"}`}>{q.remaining > 0 ? q.remaining.toLocaleString() : "0"}</td>
                <td className={`px-4 py-3.5 text-right font-medium tabular-nums ${q.remaining < 0 ? "text-amber-600" : "text-gray-400"}`}>{q.remaining < 0 ? Math.abs(q.remaining).toLocaleString() : "0"}</td>
                <td className="px-4 py-3.5 text-center">
                  {q.warranty_total === 0 ? (
                    <span className="text-gray-300 text-sm">—</span>
                  ) : q.warranty_active === q.warranty_total ? (
                    <svg className="w-5 h-5 text-green-500 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  ) : q.warranty_active === 0 ? (
                    <svg className="w-5 h-5 text-red-500 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 tabular-nums">{q.warranty_active}/{q.warranty_total}</span>
                  )}
                </td>
                <td className="px-4 py-3.5 text-gray-500">{formatDate(q.created_at)}</td>
                <td className="px-2 py-3.5">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCopy(q.id); }}
                      title={t.quotation_copy}
                      className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(q.id); }}
                      disabled={!q.deletable}
                      title={q.deletable ? t.quotation_delete : t.quotation_delete_blocked}
                      className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-gray-400 disabled:hover:bg-transparent"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <Pagination page={safePage} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
      </div>
      </div>
    </AppLayout>
  );
}
