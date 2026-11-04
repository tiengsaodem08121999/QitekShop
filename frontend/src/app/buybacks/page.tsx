"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import Pagination from "@/components/shared/Pagination";
import { useConfirm } from "@/components/Confirm";
import { useToast } from "@/components/Toast";
import { apiFetch } from "@/lib/api";
import { apiError } from "@/lib/apiError";
import { formatDate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { BuybackListItem } from "@/types";

const PAGE_SIZE = 12;
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 4 }, (_, i) => CURRENT_YEAR - i);

export default function BuybacksPage() {
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState<BuybackListItem[] | null>(null);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState<number | "all">(CURRENT_YEAR);
  const [page, setPage] = useState(1);

  useEffect(() => {
    apiFetch<BuybackListItem[]>("/api/buybacks")
      .then(setRows)
      .catch((err) => toast(apiError(err, t), "error"));
  }, [toast, t.error]);

  async function handleDelete(id: number) {
    if (!(await confirm(t.buyback_delete_prompt))) return;
    try {
      await apiFetch(`/api/buybacks/${id}`, { method: "DELETE" });
      toast(t.buyback_delete_success);
      setRows((prev) => prev && prev.filter((b) => b.id !== id));
    } catch (err) {
      toast(apiError(err, t), "error");
    }
  }

  const q = search.trim().toLowerCase();
  const filtered = (rows ?? []).filter((b) =>
    (yearFilter === "all" || new Date(b.created_at).getFullYear() === yearFilter)
    && (!q || (b.title ?? "").toLowerCase().includes(q)),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages); // stay valid after deletes
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <AppLayout>
      <div className="flex flex-col h-full overflow-hidden">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{t.buybacks_title}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{t.buybacks_subtitle}</p>
          </div>
          <select
            aria-label={t.quotations_year_all}
            value={yearFilter}
            onChange={(e) => {
              setYearFilter(e.target.value === "all" ? "all" : Number(e.target.value));
              setPage(1);
            }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
          >
            <option value="all">{t.quotations_year_all}</option>
            {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <Link href="/buybacks/new"
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          {t.buybacks_new}
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col min-h-0 flex-1">
        <div className="flex gap-3 p-4 border-b border-gray-50 shrink-0">
          <div className="relative flex-1 max-w-xs">
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input placeholder={t.buybacks_search} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors" />
          </div>
        </div>
        <div className="overflow-auto flex-1" style={{ paddingBottom: 20 }}>
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-5 py-3 font-medium">{t.buybacks_col_title}</th>
                <th className="px-4 py-3 font-medium text-right">{t.buybacks_col_total_purchase}</th>
                <th className="px-4 py-3 font-medium text-right">{t.buybacks_col_total_resale}</th>
                <th className="px-4 py-3 font-medium">{t.quotations_col_created}</th>
                <th className="px-2 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows !== null && filtered.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-400">{t.buybacks_empty}</td></tr>
              )}
              {pageItems.map((b) => (
                <tr key={b.id} onClick={() => router.push(`/buybacks/${b.id}`)} className="hover:bg-gray-50/70 cursor-pointer transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-800">{b.title}</td>
                  <td className="px-4 py-3.5 text-right font-medium tabular-nums text-gray-700">{b.total_purchase.toLocaleString()}</td>
                  <td className="px-4 py-3.5 text-right font-medium tabular-nums text-gray-700">{b.total_resale.toLocaleString()}</td>
                  <td className="px-4 py-3.5 text-gray-500">{formatDate(b.created_at)}</td>
                  <td className="px-2 py-3.5 text-center">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(b.id); }}
                      disabled={!b.deletable}
                      title={b.deletable ? t.delete : t.buyback_delete_blocked}
                      aria-label={t.delete}
                      className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-gray-400 disabled:hover:bg-transparent"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
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
