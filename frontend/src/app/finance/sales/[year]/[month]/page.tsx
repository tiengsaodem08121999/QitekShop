"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { apiError } from "@/lib/apiError";
import { useToast } from "@/components/Toast";
import type { MonthlySales } from "@/types";

/** The goods sold in a month: the detail behind the dashboard's sales profit chart. */
export default function FinanceSalesMonthPage() {
  const params = useParams();
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const year = Number(params.year);
  const month = Number(params.month);
  const [sales, setSales] = useState<MonthlySales | null>(null);

  useEffect(() => {
    let stale = false;
    apiFetch<MonthlySales>(`/api/finance/sales?year=${year}&month=${month}`)
      .then((data) => { if (!stale) setSales(data); })
      .catch((err) => { if (!stale) toast(apiError(err, t), "error"); });
    return () => { stale = true; };
  }, [year, month, toast, t.error]);

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    router.push(`/finance/sales/${d.getFullYear()}/${d.getMonth() + 1}`);
  };

  const profit = sales?.profit ?? 0;

  return (
    <AppLayout>
      <div className="flex flex-col h-full overflow-hidden">
      <div className="mb-6 shrink-0">
        <Link href={`/finance?tab=sales&year=${year}`} className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
          &larr; {t.finance_sales_back}
        </Link>
        <div className="flex items-center gap-3 mt-2">
          <button onClick={() => shiftMonth(-1)} title={t.finance_prev_month} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-white hover:border-gray-300 transition-colors text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="text-2xl font-bold text-gray-800 tabular-nums">{String(month).padStart(2, "0")} / {year}</h1>
          <button onClick={() => shiftMonth(1)} title={t.finance_next_month} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-white hover:border-gray-300 transition-colors text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6 shrink-0">
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wide">{t.finance_sales_total_purchase}</p>
          <p className="text-sm sm:text-lg font-bold text-gray-800 mt-1 break-words">{(sales?.total_purchase ?? 0).toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-blue-200 p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs font-medium text-blue-500 uppercase tracking-wide">{t.finance_sales_total_selling}</p>
          <p className="text-sm sm:text-lg font-bold text-blue-600 mt-1 break-words">{(sales?.total_selling ?? 0).toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-green-200 p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs font-medium text-green-500 uppercase tracking-wide">{t.finance_profit}</p>
          <p className={`text-sm sm:text-lg font-bold mt-1 break-words ${profit >= 0 ? "text-green-600" : "text-red-500"}`}>{profit.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 flex flex-col min-h-0 flex-1 mb-5">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/50 shrink-0">
          <span className="text-sm font-semibold text-gray-700">{t.finance_sales_list}</span>
          <span className="text-xs text-gray-400">{t.finance_sales_count(sales?.items.length ?? 0)}</span>
        </div>
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b border-gray-100">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{t.finance_sales_col_name}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">{t.finance_sales_col_purchase}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">{t.finance_sales_col_selling}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sales?.items.map((item, i) => (
                <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3 font-medium text-gray-800">{item.name}</td>
                  <td className="px-4 py-3 text-right text-gray-600 tabular-nums">{item.purchase_price.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800 tabular-nums">{item.selling_price.toLocaleString()}</td>
                </tr>
              ))}
              {sales?.items.length === 0 && (
                <tr><td colSpan={3} className="px-5 py-12 text-center text-gray-400">{t.finance_sales_empty}</td></tr>
              )}
            </tbody>
            <tfoot className="sticky bottom-0 bg-gray-50">
              <tr className="border-t border-gray-200 font-bold text-gray-800">
                <td className="px-5 py-3">{t.finance_sales_total}</td>
                <td className="px-4 py-3 text-right tabular-nums">{(sales?.total_purchase ?? 0).toLocaleString()}</td>
                <td className="px-4 py-3 text-right tabular-nums">{(sales?.total_selling ?? 0).toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      </div>
    </AppLayout>
  );
}
