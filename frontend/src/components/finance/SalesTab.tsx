"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { apiError } from "@/lib/apiError";
import { useToast } from "@/components/Toast";
import type { SalesProfitMonth } from "@/types";

/** Sales per month of a year (the dashboard chart's numbers); each month opens the goods sold. */
export default function SalesTab() {
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  // The year lives in the URL so coming back from a month's detail keeps it.
  const year = Number(useSearchParams().get("year")) || new Date().getFullYear();
  const [loaded, setLoaded] = useState<{ year: number; months: SalesProfitMonth[] } | null>(null);

  useEffect(() => {
    let stale = false;
    apiFetch<SalesProfitMonth[]>(`/api/finance/sales/yearly-summary?year=${year}`)
      .then((all) => {
        if (!stale) setLoaded({ year, months: all.filter((m) => m.revenue || m.cost) });
      })
      .catch((err) => { if (!stale) toast(apiError(err, t), "error"); });
    return () => { stale = true; };
  }, [year, toast, t.error]);

  // A response for another year must never show under this year's label.
  const months = loaded?.year === year ? loaded.months : null;
  const rows = months ?? [];
  const totalPurchase = rows.reduce((s, m) => s + m.cost, 0);
  const totalSelling = rows.reduce((s, m) => s + m.revenue, 0);
  const totalProfit = rows.reduce((s, m) => s + m.profit, 0);
  const goToYear = (y: number) => router.replace(`/finance?tab=sales&year=${y}`);

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6 shrink-0">
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wide">{t.finance_sales_total_purchase_year(year)}</p>
          <p className="text-sm sm:text-lg font-bold text-gray-800 mt-1 break-words">{totalPurchase.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-blue-200 p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs font-medium text-blue-500 uppercase tracking-wide">{t.finance_sales_total_selling_year(year)}</p>
          <p className="text-sm sm:text-lg font-bold text-blue-600 mt-1 break-words">{totalSelling.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-green-200 p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs font-medium text-green-500 uppercase tracking-wide">{t.finance_profit_year(year)}</p>
          <p className={`text-sm sm:text-lg font-bold mt-1 break-words ${totalProfit >= 0 ? "text-green-600" : "text-red-500"}`}>{totalProfit.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 flex flex-col min-h-0 flex-1 mb-5">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/50 shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={() => goToYear(year - 1)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-white hover:border-gray-300 transition-colors text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-sm font-semibold text-gray-700 min-w-[80px] text-center">{year}</span>
            <button onClick={() => goToYear(year + 1)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-white hover:border-gray-300 transition-colors text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
          <span className="text-xs text-gray-400">{t.finance_sales_months_with_sales(rows.length)}</span>
        </div>
        <div className="overflow-auto flex-1" style={{ paddingBottom: 20 }}>
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b border-gray-100">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{t.finance_col_month}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">{t.finance_sales_total_purchase}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">{t.finance_sales_total_selling}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">{t.finance_col_profit}</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((m) => (
                <tr key={m.month} onClick={() => router.push(`/finance/sales/${year}/${m.month}`)} className="hover:bg-gray-50/50 transition-colors cursor-pointer group">
                  <td className="px-5 py-4 font-medium text-gray-800">{t.months[m.month]}</td>
                  <td className="px-4 py-4 text-right text-gray-600 tabular-nums">{m.cost.toLocaleString()}</td>
                  <td className="px-4 py-4 text-right font-semibold text-blue-600 tabular-nums">{m.revenue.toLocaleString()}</td>
                  <td className={`px-4 py-4 text-right font-semibold tabular-nums ${m.profit >= 0 ? "text-green-600" : "text-red-500"}`}>{m.profit.toLocaleString()}</td>
                  <td className="px-4 py-4 text-gray-300 group-hover:text-gray-500 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </td>
                </tr>
              ))}
              {months?.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-400">{t.finance_sales_empty_year(year)}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
