"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import TransactionModal from "@/components/shared/TransactionModal";
import { apiFetch } from "@/lib/api";
import type { MonthlySummary, Transaction } from "@/types";

const MONTH_NAMES = [
  "", "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
  "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
];

export default function FinancePage() {
  const router = useRouter();
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
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Tài chính</h1>
          <p className="text-sm text-gray-500 mt-0.5">Tổng quan thu chi theo năm</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
          + Thêm giao dịch
        </button>
      </div>

      {/* Yearly summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-green-200 p-4">
          <p className="text-xs font-medium text-green-500 uppercase tracking-wide">Tổng thu {year}</p>
          <p className="text-lg font-bold text-green-600 mt-1">+{totalIncome.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-red-200 p-4">
          <p className="text-xs font-medium text-red-400 uppercase tracking-wide">Tổng chi {year}</p>
          <p className="text-lg font-bold text-red-500 mt-1">-{totalExpense.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 col-span-2 lg:col-span-1">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Lợi nhuận {year}</p>
          <p className={`text-lg font-bold mt-1 ${totalProfit >= 0 ? "text-gray-800" : "text-red-500"}`}>{totalProfit.toLocaleString()}</p>
        </div>
      </div>

      {/* Year nav + Month list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Year navigation */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2">
            <button onClick={() => setYear(year - 1)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-white hover:border-gray-300 transition-colors text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-sm font-semibold text-gray-700 min-w-[80px] text-center">
              Năm {year}
            </span>
            <button onClick={() => setYear(year + 1)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-white hover:border-gray-300 transition-colors text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
          <span className="text-xs text-gray-400">{months.length} tháng có giao dịch</span>
        </div>

        {/* Table */}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Tháng</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Tổng thu</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Tổng chi</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Lợi nhuận</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {months.map((m) => (
              <tr
                key={m.month}
                onClick={() => router.push(`/finance/${year}/${m.month}`)}
                className="hover:bg-gray-50/50 transition-colors cursor-pointer group"
              >
                <td className="px-5 py-4 font-medium text-gray-800">{MONTH_NAMES[m.month]}</td>
                <td className="px-4 py-4 text-right font-semibold text-green-600 tabular-nums">+{m.total_income.toLocaleString()}</td>
                <td className="px-4 py-4 text-right font-semibold text-red-500 tabular-nums">-{m.total_expense.toLocaleString()}</td>
                <td className={`px-4 py-4 text-right font-semibold tabular-nums ${m.profit >= 0 ? "text-gray-800" : "text-red-500"}`}>
                  {m.profit.toLocaleString()}
                </td>
                <td className="px-4 py-4 text-gray-300 group-hover:text-gray-500 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </td>
              </tr>
            ))}
            {!loading && months.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-gray-400">
                  Chưa có giao dịch nào trong năm {year}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {showModal && (
        <TransactionModal
          onClose={() => setShowModal(false)}
          onSaved={(txn: Transaction) => {
            setShowModal(false);
            const d = new Date(txn.date);
            router.push(`/finance/${d.getFullYear()}/${d.getMonth() + 1}`);
          }}
        />
      )}
    </AppLayout>
  );
}
