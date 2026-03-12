"use client";

import { useCallback, useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import TransactionModal from "@/components/shared/TransactionModal";
import { apiFetch } from "@/lib/api";
import type { MonthlySummary, PaginatedResponse, Transaction } from "@/types";

export default function FinancePage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editTxn, setEditTxn] = useState<Transaction | undefined>();

  const load = useCallback(() => {
    apiFetch<PaginatedResponse<Transaction>>(`/api/finance/transactions?year=${year}&month=${month}&limit=200`).then((r) => setTxns(r.items));
    apiFetch<MonthlySummary>(`/api/finance/summary?year=${year}&month=${month}`).then(setSummary);
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
  }

  async function handleDelete(id: number) {
    if (!confirm("Xóa giao dịch này?")) return;
    await apiFetch(`/api/finance/transactions/${id}`, { method: "DELETE" });
    load();
  }

  const openingBalance = summary?.opening_balance || 0;
  let runningBalance = openingBalance;

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Tài chính</h1>
          <p className="text-sm text-gray-500 mt-0.5">Quản lý thu chi hàng tháng</p>
        </div>
        <button onClick={() => { setEditTxn(undefined); setShowModal(true); }}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
          + Thêm giao dịch
        </button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Tài khoản đầu</p>
            <p className="text-lg font-bold text-gray-700 mt-1">{summary.opening_balance.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border border-green-200 p-4">
            <p className="text-xs font-medium text-green-500 uppercase tracking-wide">Tổng thu</p>
            <p className="text-lg font-bold text-green-600 mt-1">+{summary.total_income.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border border-red-200 p-4">
            <p className="text-xs font-medium text-red-400 uppercase tracking-wide">Tổng chi</p>
            <p className="text-lg font-bold text-red-500 mt-1">-{summary.total_expense.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Lợi nhuận</p>
            <p className={`text-lg font-bold mt-1 ${summary.profit >= 0 ? "text-gray-800" : "text-red-500"}`}>{summary.profit.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 col-span-2 lg:col-span-1">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Số dư hiện tại</p>
            <p className="text-xl font-bold text-gray-700 mt-1">{summary.closing_balance.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Month nav + Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Month navigation */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-white hover:border-gray-300 transition-colors text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-sm font-semibold text-gray-700 min-w-[140px] text-center">
              Tháng {String(month).padStart(2, "0")} / {year}
            </span>
            <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-white hover:border-gray-300 transition-colors text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
          <span className="text-xs text-gray-400">{txns.length} giao dịch</span>
        </div>

        {/* Table */}
        <div className="overflow-auto max-h-[calc(100vh-320px)]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="border-b border-gray-100">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Ngày</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Danh mục</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Loại</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Số tiền</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Ghi chú</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Số dư</th>
              <th className="px-4 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {txns.map((t) => {
              runningBalance += t.type === "thu" ? t.amount : -t.amount;
              return (
                <tr key={t.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-5 py-3 text-gray-500 tabular-nums">
                    {new Date(t.date).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{t.description}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      t.type === "thu"
                        ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-200"
                        : "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200"
                    }`}>
                      {t.type === "thu" ? "Thu" : "Chi"}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold tabular-nums ${t.type === "thu" ? "text-green-600" : "text-red-500"}`}>
                    {t.type === "thu" ? "+" : "-"}{t.amount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-gray-400 max-w-[200px] truncate">{t.notes}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-700 tabular-nums">{runningBalance.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                      <button onClick={() => { setEditTxn(t); setShowModal(true); }}
                        className="p-1.5 rounded-md hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                      <button onClick={() => handleDelete(t.id)}
                        className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {txns.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-gray-400">
                  Chưa có giao dịch nào trong tháng này
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {showModal && (
        <TransactionModal
          initial={editTxn}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </AppLayout>
  );
}
