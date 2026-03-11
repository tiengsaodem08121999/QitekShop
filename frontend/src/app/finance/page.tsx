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

  // Running balance
  const openingBalance = summary?.opening_balance || 0;
  let runningBalance = openingBalance;

  return (
    <AppLayout>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="border px-3 py-1 rounded hover:bg-gray-50">&lt;</button>
          <span className="text-lg font-bold">Tháng {String(month).padStart(2, "0")} / {year}</span>
          <button onClick={nextMonth} className="border px-3 py-1 rounded hover:bg-gray-50">&gt;</button>
        </div>
        <button onClick={() => { setEditTxn(undefined); setShowModal(true); }}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
          + Thêm giao dịch
        </button>
      </div>

      <div className="grid grid-cols-[2fr_1fr] gap-0">
        {/* Transactions table */}
        <div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left font-semibold">Ngày</th>
                <th className="px-3 py-2 text-left font-semibold">Danh mục</th>
                <th className="px-3 py-2 font-semibold">Loại</th>
                <th className="px-3 py-2 text-right font-semibold">Số tiền</th>
                <th className="px-3 py-2 text-left font-semibold">Ghi chú</th>
                <th className="px-3 py-2 text-right font-semibold">Số dư</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {txns.map((t) => {
                runningBalance += t.type === "thu" ? t.amount : -t.amount;
                return (
                  <tr key={t.id} className="border-b border-gray-100">
                    <td className="px-4 py-2">{new Date(t.date).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}</td>
                    <td className="px-3 py-2">{t.description}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={t.type === "thu" ? "text-green-600" : "text-red-600"}>
                        {t.type === "thu" ? "Thu" : "Chi"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">{t.amount.toLocaleString()}</td>
                    <td className="px-3 py-2 text-gray-500">{t.notes}</td>
                    <td className="px-3 py-2 text-right">{runningBalance.toLocaleString()}</td>
                    <td className="px-2 py-2">
                      <button onClick={() => { setEditTxn(t); setShowModal(true); }} className="text-gray-400 hover:text-blue-600 text-xs mr-1">Edit</button>
                      <button onClick={() => handleDelete(t.id)} className="text-gray-400 hover:text-red-600 text-xs">Del</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Summary panel */}
        {summary && (
          <div className="border-l border-gray-200 p-4">
            <div className="font-semibold mb-3">Tổng Hợp</div>
            <table className="w-full text-sm">
              <tbody>
                <tr><td className="py-2">Tài khoản đầu</td><td className="py-2 text-right">{summary.opening_balance.toLocaleString()}</td></tr>
                <tr className="border-t"><td className="py-2 text-green-600">Tổng Thu</td><td className="py-2 text-right text-green-600">{summary.total_income.toLocaleString()}</td></tr>
                <tr className="border-t"><td className="py-2 text-red-600">Tổng Chi</td><td className="py-2 text-right text-red-600">{summary.total_expense.toLocaleString()}</td></tr>
                <tr className="border-t-2 border-gray-800"><td className="py-2 font-semibold">Lợi nhuận</td><td className="py-2 text-right font-semibold">{summary.profit.toLocaleString()}</td></tr>
                <tr className="border-t bg-green-50"><td className="py-2 font-semibold">Tài khoản hiện tại</td><td className="py-2 text-right font-semibold text-green-600">{summary.closing_balance.toLocaleString()}</td></tr>
              </tbody>
            </table>
          </div>
        )}
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
