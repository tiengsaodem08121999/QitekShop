"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { Customer, PaginatedResponse, QuotationItem } from "@/types";

interface Props {
  mode: "create" | "edit";
  quotationId?: number;
  initialCustomer?: Customer;
  initialItems?: QuotationItem[];
  initialPaid?: number;
}

const EMPTY_ITEM: QuotationItem = {
  is_trade_in: false, name: "", condition: "2nd",
  purchase_price: 0, selling_price: 0, warranty: "3th",
  warranty_start: null, delivery_date: null, notes: null,
};

const EMPTY_TRADE_IN: QuotationItem = {
  is_trade_in: true, name: "", condition: null,
  purchase_price: 0, selling_price: 0, warranty: null,
  warranty_start: null, delivery_date: null, notes: null,
};

export default function QuotationForm({ mode, quotationId, initialCustomer, initialItems, initialPaid }: Props) {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(initialCustomer?.id || null);
  const [isNewCustomer, setIsNewCustomer] = useState(!initialCustomer);
  const [customerName, setCustomerName] = useState(initialCustomer?.name || "");
  const [customerPhone, setCustomerPhone] = useState(initialCustomer?.phone || "");
  const [items, setItems] = useState<QuotationItem[]>(
    initialItems?.filter((i) => !i.is_trade_in) || [{ ...EMPTY_ITEM }]
  );
  const [tradeIns, setTradeIns] = useState<QuotationItem[]>(
    initialItems?.filter((i) => i.is_trade_in) || []
  );
  const [totalPaid, setTotalPaid] = useState(initialPaid || 0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode === "create") {
      apiFetch<PaginatedResponse<Customer>>("/api/customers").then((r) => setCustomers(r.items));
    }
  }, [mode]);

  function updateItem(index: number, field: string, value: string | number) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function updateTradeIn(index: number, field: string, value: string | number) {
    setTradeIns((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const allItems = [
      ...items.map((i) => ({ ...i, is_trade_in: false })),
      ...tradeIns.map((i) => ({ ...i, is_trade_in: true, selling_price: 0, condition: null })),
    ];

    try {
      if (mode === "create") {
        const payload: Record<string, unknown> = { items: allItems };
        if (isNewCustomer) {
          payload.new_customer = { name: customerName, phone: customerPhone || null };
        } else {
          payload.customer_id = selectedCustomerId;
        }
        const res = await apiFetch<{ id: number }>("/api/quotations", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        router.push(`/quotations/${res.id}`);
      } else {
        await apiFetch(`/api/quotations/${quotationId}`, {
          method: "PUT",
          body: JSON.stringify({ total_paid: totalPaid, items: allItems }),
        });
        router.push(`/quotations/${quotationId}`);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Customer */}
      {mode === "create" && (
        <div className="space-y-3">
          <div className="flex gap-3 items-center">
            <label className="flex items-center gap-1 text-sm">
              <input type="radio" checked={!isNewCustomer} onChange={() => setIsNewCustomer(false)} /> Khách hàng cũ
            </label>
            <label className="flex items-center gap-1 text-sm">
              <input type="radio" checked={isNewCustomer} onChange={() => setIsNewCustomer(true)} /> Khách hàng mới
            </label>
          </div>
          {!isNewCustomer ? (
            <select value={selectedCustomerId || ""} onChange={(e) => setSelectedCustomerId(Number(e.target.value))}
              className="border rounded px-3 py-2 w-full text-sm" required>
              <option value="">— Chọn khách hàng —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ""}</option>)}
            </select>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tên khách hàng *</label>
                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                  className="border rounded px-3 py-2 w-full text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Số điện thoại</label>
                <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)}
                  className="border rounded px-3 py-2 w-full text-sm" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Products */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="font-semibold">Sản phẩm</span>
          <button type="button" onClick={() => setItems([...items, { ...EMPTY_ITEM }])}
            className="text-blue-600 text-sm">+ Thêm dòng</button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-2 py-2 text-left">Tên *</th>
              <th className="px-2 py-2">TT</th>
              <th className="px-2 py-2 text-right">Giá mua</th>
              <th className="px-2 py-2 text-right">Giá bán</th>
              <th className="px-2 py-2">BH</th>
              <th className="px-2 py-2">Ngày BH</th>
              <th className="px-2 py-2">Ngày nhận</th>
              <th className="px-2 py-2">Ghi chú</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b">
                <td className="px-1 py-1"><input value={item.name} onChange={(e) => updateItem(i, "name", e.target.value)} className="border rounded px-2 py-1 w-full text-sm" required /></td>
                <td className="px-1 py-1">
                  <select value={item.condition || "2nd"} onChange={(e) => updateItem(i, "condition", e.target.value)} className="border rounded px-2 py-1 text-sm">
                    <option value="2nd">2nd</option><option value="new">new</option>
                  </select>
                </td>
                <td className="px-1 py-1"><input type="number" value={item.purchase_price} onChange={(e) => updateItem(i, "purchase_price", Number(e.target.value))} className="border rounded px-2 py-1 w-20 text-right text-sm" /></td>
                <td className="px-1 py-1"><input type="number" value={item.selling_price} onChange={(e) => updateItem(i, "selling_price", Number(e.target.value))} className="border rounded px-2 py-1 w-20 text-right text-sm" /></td>
                <td className="px-1 py-1"><input value={item.warranty || ""} onChange={(e) => updateItem(i, "warranty", e.target.value)} className="border rounded px-2 py-1 w-16 text-sm" /></td>
                <td className="px-1 py-1"><input type="date" value={item.warranty_start || ""} onChange={(e) => updateItem(i, "warranty_start", e.target.value)} className="border rounded px-2 py-1 text-sm" /></td>
                <td className="px-1 py-1"><input type="date" value={item.delivery_date || ""} onChange={(e) => updateItem(i, "delivery_date", e.target.value)} className="border rounded px-2 py-1 text-sm" /></td>
                <td className="px-1 py-1"><input value={item.notes || ""} onChange={(e) => updateItem(i, "notes", e.target.value)} className="border rounded px-2 py-1 w-24 text-sm" /></td>
                <td className="px-1"><button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">x</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Trade-ins */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="font-semibold">Thu cũ</span>
          <button type="button" onClick={() => setTradeIns([...tradeIns, { ...EMPTY_TRADE_IN }])}
            className="text-blue-600 text-sm">+ Thêm thu cũ</button>
        </div>
        {tradeIns.length > 0 && (
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50"><th className="px-2 py-2 text-left">Tên</th><th className="px-2 py-2 text-right">Giá thu</th><th></th></tr></thead>
            <tbody>
              {tradeIns.map((item, i) => (
                <tr key={i} className="border-b">
                  <td className="px-1 py-1"><input value={item.name} onChange={(e) => updateTradeIn(i, "name", e.target.value)} className="border rounded px-2 py-1 w-full text-sm" /></td>
                  <td className="px-1 py-1"><input type="number" value={item.purchase_price} onChange={(e) => updateTradeIn(i, "purchase_price", Number(e.target.value))} className="border rounded px-2 py-1 w-28 text-right text-sm" /></td>
                  <td className="px-1"><button type="button" onClick={() => setTradeIns(tradeIns.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">x</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Total paid (edit mode) */}
      {mode === "edit" && (
        <div>
          <label className="block text-sm font-medium mb-1">Số tiền đã thanh toán</label>
          <input type="number" value={totalPaid} onChange={(e) => setTotalPaid(Number(e.target.value))}
            className="border rounded px-3 py-2 w-48 text-sm" />
        </div>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="bg-blue-600 text-white px-6 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
          {saving ? "Đang lưu..." : mode === "create" ? "Tạo báo giá" : "Cập nhật"}
        </button>
        <button type="button" onClick={() => router.back()}
          className="border px-4 py-2 rounded text-sm hover:bg-gray-50">Hủy</button>
      </div>
    </form>
  );
}
