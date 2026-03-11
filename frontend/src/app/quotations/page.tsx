"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/api";
import type { PaginatedResponse, QuotationListItem, QuotationStatus } from "@/types";

const STATUS_LABELS: Record<QuotationStatus, { label: string; className: string }> = {
  draft: { label: "Đang báo giá", className: "bg-yellow-100 text-yellow-800" },
  confirmed: { label: "Đã chốt", className: "bg-green-100 text-green-800" },
};

export default function QuotationsPage() {
  const [data, setData] = useState<PaginatedResponse<QuotationListItem> | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<QuotationStatus | "">("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    apiFetch<PaginatedResponse<QuotationListItem>>(`/api/quotations?${params}`).then(setData);
  }, [search, statusFilter]);

  return (
    <AppLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">Báo giá</h1>
        <Link
          href="/quotations/new"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
        >
          + Tạo báo giá
        </Link>
      </div>

      <div className="flex gap-3 mb-4">
        <input
          placeholder="Tìm khách hàng..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 w-64 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as QuotationStatus | "")}
          className="border border-gray-300 rounded px-3 py-2 text-sm"
        >
          <option value="">Tất cả</option>
          <option value="draft">Đang báo giá</option>
          <option value="confirmed">Đã chốt</option>
        </select>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-left">
            <th className="px-4 py-3 font-semibold">Khách hàng</th>
            <th className="px-3 py-3 font-semibold">Trạng thái</th>
            <th className="px-3 py-3 font-semibold text-right">Tổng giá bán</th>
            <th className="px-3 py-3 font-semibold text-right">Đã thanh toán</th>
            <th className="px-3 py-3 font-semibold text-right">Còn nợ</th>
            <th className="px-3 py-3 font-semibold">Ngày tạo</th>
          </tr>
        </thead>
        <tbody>
          {data?.items.map((q) => {
            const badge = STATUS_LABELS[q.status];
            return (
              <tr key={q.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer">
                <td className="px-4 py-3">
                  <Link href={`/quotations/${q.id}`} className="font-medium hover:text-blue-600">
                    {q.customer_name}
                  </Link>
                </td>
                <td className="px-3 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs ${badge.className}`}>
                    {badge.label}
                  </span>
                </td>
                <td className="px-3 py-3 text-right">{q.total_amount.toLocaleString()}</td>
                <td className="px-3 py-3 text-right">{q.total_paid.toLocaleString()}</td>
                <td className={`px-3 py-3 text-right ${q.remaining > 0 ? "text-red-600" : "text-green-600"}`}>
                  {q.remaining > 0 ? q.remaining.toLocaleString() : "0"}
                </td>
                <td className="px-3 py-3 text-gray-500">
                  {new Date(q.created_at).toLocaleDateString("vi-VN")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </AppLayout>
  );
}
