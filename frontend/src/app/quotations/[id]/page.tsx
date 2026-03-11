"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/api";
import type { Quotation } from "@/types";

export default function QuotationDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [q, setQ] = useState<Quotation | null>(null);

  useEffect(() => {
    apiFetch<Quotation>(`/api/quotations/${id}`).then(setQ);
  }, [id]);

  async function handleConfirm() {
    if (!confirm("Chốt báo giá này?")) return;
    const updated = await apiFetch<Quotation>(`/api/quotations/${id}/confirm`, { method: "PATCH" });
    setQ(updated);
  }

  async function handleExportPDF() {
    const token = localStorage.getItem("token");
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/quotations/${id}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bao-gia-${id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDelete() {
    if (!confirm("Xóa báo giá này?")) return;
    await apiFetch(`/api/quotations/${id}`, { method: "DELETE" });
    router.push("/quotations");
  }

  if (!q) return <AppLayout><p>Đang tải...</p></AppLayout>;

  const products = q.items.filter((i) => !i.is_trade_in);
  const tradeIns = q.items.filter((i) => i.is_trade_in);

  return (
    <AppLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold">{q.customer.name}</h1>
          <span
            className={`text-xs px-2 py-1 rounded-full ${
              q.status === "confirmed" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
            }`}
          >
            {q.status === "confirmed" ? "Đã chốt" : "Đang báo giá"}
          </span>
        </div>
        <div className="flex gap-2">
          {q.status === "draft" && (
            <>
              <button onClick={() => router.push(`/quotations/${id}/edit`)} className="border px-3 py-2 rounded text-sm hover:bg-gray-50">
                Sửa
              </button>
              <button onClick={handleConfirm} className="bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700">
                Chốt
              </button>
              <button onClick={handleDelete} className="border border-red-300 text-red-600 px-3 py-2 rounded text-sm hover:bg-red-50">
                Xóa
              </button>
            </>
          )}
          <button onClick={handleExportPDF} className="bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700">
            Xuất PDF
          </button>
        </div>
      </div>

      {/* Products table */}
      <div className="font-semibold mb-2">Sản phẩm</div>
      <table className="w-full text-sm mb-6">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-4 py-2 text-left font-semibold">Tên</th>
            <th className="px-3 py-2 text-left font-semibold">TT</th>
            <th className="px-3 py-2 text-right font-semibold">Giá mua</th>
            <th className="px-3 py-2 text-right font-semibold">Giá bán</th>
            <th className="px-3 py-2 font-semibold">BH</th>
            <th className="px-3 py-2 font-semibold">Ngày BH</th>
            <th className="px-3 py-2 font-semibold">Ngày nhận</th>
            <th className="px-3 py-2 font-semibold">Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          {products.map((item, i) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="px-4 py-2">{item.name}</td>
              <td className="px-3 py-2">{item.condition}</td>
              <td className="px-3 py-2 text-right">{item.purchase_price.toLocaleString()}</td>
              <td className="px-3 py-2 text-right">{item.selling_price.toLocaleString()}</td>
              <td className="px-3 py-2">{item.warranty}</td>
              <td className="px-3 py-2">{item.warranty_start}</td>
              <td className="px-3 py-2">{item.delivery_date}</td>
              <td className="px-3 py-2 text-gray-500">{item.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid grid-cols-2 gap-6">
        {/* Trade-ins */}
        {tradeIns.length > 0 && (
          <div>
            <div className="font-semibold mb-2">Thu cũ</div>
            <table className="w-full text-sm">
              <tbody>
                {tradeIns.map((item, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2">{item.name}</td>
                    <td className="py-2 text-right">{item.purchase_price.toLocaleString()}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-2">Tổng thu cũ</td>
                  <td className="py-2 text-right">{q.total_trade_in.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Summary */}
        <div>
          <div className="font-semibold mb-2">Tổng hợp</div>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b"><td className="py-2">Tổng giá mua</td><td className="py-2 text-right">{q.total_purchase.toLocaleString()}</td></tr>
              <tr className="border-b"><td className="py-2 font-semibold">Tổng giá bán</td><td className="py-2 text-right font-semibold">{q.total_amount.toLocaleString()}</td></tr>
              <tr className="border-b"><td className="py-2">Đã thanh toán</td><td className="py-2 text-right">{q.total_paid.toLocaleString()}</td></tr>
              {q.total_trade_in > 0 && <tr className="border-b"><td className="py-2">Thu cũ</td><td className="py-2 text-right">{q.total_trade_in.toLocaleString()}</td></tr>}
              <tr className="border-b bg-red-50"><td className="py-2 font-semibold">Còn lại</td><td className={`py-2 text-right font-semibold ${q.remaining > 0 ? "text-red-600" : "text-green-600"}`}>{q.remaining.toLocaleString()}</td></tr>
              <tr><td className="py-2">Lợi nhuận</td><td className="py-2 text-right text-green-600">{q.profit.toLocaleString()}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
