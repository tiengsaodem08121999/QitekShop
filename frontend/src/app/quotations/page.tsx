"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { PaginatedResponse, QuotationListItem } from "@/types";

export default function QuotationsPage() {
  const router = useRouter();
  const t = useT();
  const [data, setData] = useState<PaginatedResponse<QuotationListItem> | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    apiFetch<PaginatedResponse<QuotationListItem>>(`/api/quotations?${params}`).then(setData);
  }, [search]);

  const items = data?.items ?? [];
  const totalAmount = items.reduce((s, q) => s + q.total_amount, 0);
  const totalPaid = items.reduce((s, q) => s + q.total_paid, 0);
  const totalRemaining = items.reduce((s, q) => s + q.remaining, 0);

  return (
    <AppLayout>
      <div className="flex justify-between items-center mb-6">
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

      <div className="grid grid-cols-4 gap-4 mb-6">
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
              <div className={`text-xl font-bold ${totalRemaining > 0 ? "text-red-600" : "text-gray-800"}`}>{totalRemaining.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-6">
        <div className="flex gap-3 p-4 border-b border-gray-50">
          <div className="relative flex-1 max-w-xs">
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input placeholder={t.quotations_search} value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors" />
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
              <th className="px-5 py-3 font-medium">{t.quotations_col_customer}</th>
              <th className="px-4 py-3 font-medium text-right">{t.quotations_col_total}</th>
              <th className="px-4 py-3 font-medium text-right">{t.quotations_col_paid}</th>
              <th className="px-4 py-3 font-medium text-right">{t.quotations_col_outstanding}</th>
              <th className="px-4 py-3 font-medium">{t.quotations_col_created}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                {t.quotations_empty}
              </td></tr>
            )}
            {items.map((q) => (
              <tr key={q.id} onClick={() => router.push(`/quotations/${q.id}`)} className="hover:bg-gray-50/70 cursor-pointer transition-colors">
                <td className="px-5 py-3.5"><div className="font-medium text-gray-800">{q.customer_name}</div><div className="text-xs text-gray-400 mt-0.5">#{q.id}</div></td>
                <td className="px-4 py-3.5 text-right font-medium tabular-nums text-gray-700">{q.total_amount.toLocaleString()}</td>
                <td className="px-4 py-3.5 text-right tabular-nums text-gray-600">{q.total_paid.toLocaleString()}</td>
                <td className={`px-4 py-3.5 text-right font-medium tabular-nums ${q.remaining > 0 ? "text-red-600" : "text-emerald-600"}`}>{q.remaining > 0 ? q.remaining.toLocaleString() : "0"}</td>
                <td className="px-4 py-3.5 text-gray-500">{new Date(q.created_at).toLocaleDateString("vi-VN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
