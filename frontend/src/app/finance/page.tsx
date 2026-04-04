"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import TransactionModal from "@/components/shared/TransactionModal";
import { apiFetch } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { MonthlySummary, Transaction } from "@/types";

export default function FinancePage() {
  const router = useRouter();
  const t = useT();
  const [year, setYear] = useState(new Date().getFullYear());
  const [months, setMonths] = useState<MonthlySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<MonthlySummary[]>(`/api/finance/yearly-summary?year=${year}`)
      .then(setMonths)
      .finally(() => setLoading(false));
  }, [year]);

  useEffect(() => { load(); }, [load]);

  const totalIncome = months.reduce((s, m) => s + m.total_income, 0);
  const totalExpense = months.reduce((s, m) => s + m.total_expense, 0);
  const totalProfit = totalIncome - totalExpense;

  return (
    <AppLayout>
      <div className="flex flex-col h-full overflow-hidden">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t.finance_title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t.finance_subtitle}</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
          {t.finance_add_txn}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6 shrink-0">
        <div className="bg-white rounded-xl border border-green-200 p-4">
          <p className="text-xs font-medium text-green-500 uppercase tracking-wide">{t.finance_total_income(year)}</p>
          <p className="text-lg font-bold text-green-600 mt-1">+{totalIncome.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-red-200 p-4">
          <p className="text-xs font-medium text-red-400 uppercase tracking-wide">{t.finance_total_expense(year)}</p>
          <p className="text-lg font-bold text-red-500 mt-1">-{totalExpense.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 col-span-2 lg:col-span-1">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{t.finance_profit_year(year)}</p>
          <p className={`text-lg font-bold mt-1 ${totalProfit >= 0 ? "text-gray-800" : "text-red-500"}`}>{totalProfit.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 flex flex-col min-h-0 flex-1 mb-5">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/50 shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={() => setYear(year - 1)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-white hover:border-gray-300 transition-colors text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-sm font-semibold text-gray-700 min-w-[80px] text-center">{year}</span>
            <button onClick={() => setYear(year + 1)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-white hover:border-gray-300 transition-colors text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
          <span className="text-xs text-gray-400">{t.finance_months_with_txn(months.length)}</span>
        </div>
        <div className="overflow-auto flex-1" style={{ paddingBottom: 20 }}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="border-b border-gray-100">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{t.finance_col_month}</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">{t.finance_col_income}</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">{t.finance_col_expense}</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">{t.finance_col_profit}</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {months.map((m) => (
              <tr key={m.month} onClick={() => router.push(`/finance/${year}/${m.month}`)} className="hover:bg-gray-50/50 transition-colors cursor-pointer group">
                <td className="px-5 py-4 font-medium text-gray-800">{t.months[m.month]}</td>
                <td className="px-4 py-4 text-right font-semibold text-green-600 tabular-nums">+{m.total_income.toLocaleString()}</td>
                <td className="px-4 py-4 text-right font-semibold text-red-500 tabular-nums">-{m.total_expense.toLocaleString()}</td>
                <td className={`px-4 py-4 text-right font-semibold tabular-nums ${m.profit >= 0 ? "text-gray-800" : "text-red-500"}`}>{m.profit.toLocaleString()}</td>
                <td className="px-4 py-4 text-gray-300 group-hover:text-gray-500 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </td>
              </tr>
            ))}
            {!loading && months.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-400">{t.finance_no_txn(year)}</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
      </div>
      {showModal && (
        <TransactionModal onClose={() => setShowModal(false)}
          onSaved={(txn: Transaction) => { setShowModal(false); const d = new Date(txn.date); router.push(`/finance/${d.getFullYear()}/${d.getMonth() + 1}`); }} />
      )}
    </AppLayout>
  );
}
