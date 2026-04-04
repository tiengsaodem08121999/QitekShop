"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/api";
import { formatDate, formatNumber, parseNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/Toast";
import type { Payment, PaymentMethod, PaymentType, Quotation, Return, ReturnReason } from "@/types";

export default function QuotationDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const contentRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState<Quotation | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [showCost, setShowCost] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    method: "transfer" as PaymentMethod,
    payment_type: "payment" as PaymentType,
    date: new Date().toISOString().split("T")[0],
    note: "",
  });
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [editingReturn, setEditingReturn] = useState<Return | null>(null);
  const [returnForm, setReturnForm] = useState({
    item_name: "",
    reason: "seller_fault" as ReturnReason,
    selling_price: "",
    refund_percent: "100",
    date: new Date().toISOString().split("T")[0],
    note: "",
  });

  useEffect(() => {
    apiFetch<Quotation>(`/api/quotations/${id}`).then(setQ);
  }, [id]);

  async function handleConfirm() {
    if (!window.confirm(t.quotation_confirm_prompt)) return;
    const updated = await apiFetch<Quotation>(`/api/quotations/${id}/confirm`, { method: "PATCH" });
    setQ(updated);
  }

  async function handleExportPDF() {
    const token = localStorage.getItem("token");
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/quotations/${id}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quotation-${id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleScreenshot() {
    if (!contentRef.current) return;
    contentRef.current.classList.add("screenshot-mode");
    const { default: html2canvas } = await import("html2canvas-pro");
    const canvas = await html2canvas(contentRef.current, { backgroundColor: "#f3f4f6", scale: 2 });
    contentRef.current.classList.remove("screenshot-mode");
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `quotation-${id}.png`;
    a.click();
  }

  function openAddPayment() {
    setEditingPayment(null);
    setPaymentForm({
      amount: "",
      method: "transfer",
      payment_type: "payment",
      date: new Date().toISOString().split("T")[0],
      note: "",
    });
    setShowPaymentModal(true);
  }

  function openEditPayment(p: Payment) {
    setEditingPayment(p);
    setPaymentForm({
      amount: formatNumber(p.amount),
      method: p.method,
      payment_type: p.payment_type,
      date: p.date,
      note: p.note || "",
    });
    setShowPaymentModal(true);
  }

  async function handlePaymentSubmit() {
    const body = {
      amount: parseNumber(paymentForm.amount),
      method: paymentForm.method,
      payment_type: paymentForm.payment_type,
      date: paymentForm.date,
      note: paymentForm.note || null,
    };
    if (editingPayment) {
      await apiFetch(`/api/quotations/${id}/payments/${editingPayment.id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
    } else {
      await apiFetch(`/api/quotations/${id}/payments`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    }
    setShowPaymentModal(false);
    toast(editingPayment ? "Cập nhật thanh toán thành công" : "Thêm thanh toán thành công");
    const updated = await apiFetch<Quotation>(`/api/quotations/${id}`);
    setQ(updated);
  }

  async function handleDeletePayment(paymentId: number) {
    if (!window.confirm(t.payment_confirm_delete)) return;
    await apiFetch(`/api/quotations/${id}/payments/${paymentId}`, { method: "DELETE" });
    toast("Xóa thanh toán thành công");
    const updated = await apiFetch<Quotation>(`/api/quotations/${id}`);
    setQ(updated);
  }

  function openAddReturn() {
    setEditingReturn(null);
    setReturnForm({ item_name: "", reason: "seller_fault", selling_price: "", refund_percent: "100", date: new Date().toISOString().split("T")[0], note: "" });
    setShowReturnModal(true);
  }

  function openEditReturn(r: Return) {
    setEditingReturn(r);
    setReturnForm({
      item_name: r.item_name,
      reason: r.reason,
      selling_price: formatNumber(r.selling_price),
      refund_percent: String(r.refund_percent),
      date: r.date,
      note: r.note || "",
    });
    setShowReturnModal(true);
  }

  async function handleReturnSubmit() {
    const body = {
      item_name: returnForm.item_name,
      reason: returnForm.reason,
      selling_price: parseNumber(returnForm.selling_price),
      refund_percent: parseInt(returnForm.refund_percent) || 0,
      date: returnForm.date,
      note: returnForm.note || null,
    };
    if (editingReturn) {
      await apiFetch(`/api/quotations/${id}/returns/${editingReturn.id}`, { method: "PUT", body: JSON.stringify(body) });
    } else {
      await apiFetch(`/api/quotations/${id}/returns`, { method: "POST", body: JSON.stringify(body) });
    }
    setShowReturnModal(false);
    toast(editingReturn ? "Cập nhật trả hàng thành công" : "Thêm trả hàng thành công");
    const updated = await apiFetch<Quotation>(`/api/quotations/${id}`);
    setQ(updated);
  }

  async function handleDeleteReturn(returnId: number) {
    if (!window.confirm(t.return_confirm_delete)) return;
    await apiFetch(`/api/quotations/${id}/returns/${returnId}`, { method: "DELETE" });
    toast("Xóa trả hàng thành công");
    const updated = await apiFetch<Quotation>(`/api/quotations/${id}`);
    setQ(updated);
  }

  if (!q) return <AppLayout><p>{t.loading}</p></AppLayout>;

  const products = q.items.filter((i) => !i.is_trade_in);
  const tradeIns = q.items.filter((i) => i.is_trade_in);
  const returnedNames = new Set(q.returns.map((r) => r.item_name));

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/quotations")}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-white hover:border-gray-300 transition-colors text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{q.customer.name}</h1>
            <p className="text-sm text-gray-400 mt-0.5">#{q.id} &middot; {formatDate(q.created_at)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => router.push(`/quotations/${id}/edit`)}
            className="inline-flex items-center gap-1.5 border border-gray-200 px-3.5 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors text-gray-700">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            {t.edit}
          </button>
          <button onClick={handleScreenshot}
            className="inline-flex items-center gap-1.5 border border-gray-200 px-3.5 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors text-gray-700">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            {t.quotation_screenshot}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">{t.quotation_total_selling}</p>
          <p className="text-xl font-bold text-gray-800 mt-1">{q.total_amount.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">{t.quotation_paid}</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{q.total_paid.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">{t.quotation_remaining}</p>
          <p className={`text-xl font-bold mt-1 ${q.remaining > 0 ? "text-red-600" : "text-emerald-600"}`}>{q.remaining.toLocaleString()}</p>
        </div>
        {showCost && (
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{t.quotation_profit}</p>
            <p className={`text-xl font-bold mt-1 ${q.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{q.profit.toLocaleString()}</p>
          </div>
        )}
      </div>

      <div ref={contentRef}>
      {/* Products table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider hide-on-screenshot">{t.quotation_products}</h3>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider show-on-screenshot">{q.customer.name}</h3>
        </div>
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="w-[4%] px-2 py-3 text-center hide-on-screenshot">
                <input type="checkbox"
                  checked={products.length > 0 && checkedItems.size === products.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setCheckedItems(new Set(products.map((_, i) => i)));
                    } else {
                      setCheckedItems(new Set());
                    }
                  }}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </th>
              <th className="w-[22%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.quotation_col_name}</th>
              <th className="w-[6%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.quotation_col_cond}</th>
              <th className="w-[14%] px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider hide-on-screenshot">
                <button onClick={() => setShowCost(!showCost)} className="inline-flex items-center gap-1 hover:text-gray-700 transition-colors" title={t.quotation_col_cost}>
                  {t.quotation_col_cost}
                  {showCost ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  )}
                </button>
              </th>
              <th className="w-[14%] px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t.quotation_col_price}</th>
              <th className="w-[8%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.quotation_col_warranty}</th>
              <th className="w-[14%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.quotation_col_warranty_date}</th>
              <th className="w-[14%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.quotation_col_notes}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {products.map((item, i) => {
              const isReturned = returnedNames.has(item.name);
              return (
              <tr key={i} className={`hover:bg-gray-50/50 transition-colors ${isReturned ? "line-through opacity-50" : ""}`}>
                <td className="px-2 py-3 text-center hide-on-screenshot">
                  <input type="checkbox"
                    checked={checkedItems.has(i)}
                    onChange={(e) => {
                      const next = new Set(checkedItems);
                      if (e.target.checked) next.add(i); else next.delete(i);
                      setCheckedItems(next);
                    }}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </td>
                <td className="px-4 py-3 font-medium text-gray-800">{item.name}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                    item.condition === "new" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"
                  }`}>{item.condition}</span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-600 hide-on-screenshot">{showCost ? item.purchase_price.toLocaleString() : "•••"}</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-800">{item.selling_price.toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-500">{item.warranty}</td>
                <td className="px-4 py-3 text-gray-500">{item.warranty_start || t.dash}</td>
                <td className="px-4 py-3 text-gray-400">{item.notes || t.dash}</td>
              </tr>
              );
            })}
          </tbody>
          <tfoot className="hide-on-screenshot">
            <tr className="bg-gray-50/80 border-t border-gray-200">
              <td></td>
              <td className="px-4 py-3 font-semibold text-gray-700" colSpan={2}>{t.quotation_total || "Tổng tiền"}</td>
              <td className="px-4 py-3 text-right tabular-nums font-bold text-gray-600">
                {showCost
                  ? products.filter((_, i) => checkedItems.has(i)).reduce((sum, item) => sum + item.purchase_price, 0).toLocaleString()
                  : "•••"}
              </td>
              <td className="px-4 py-3 text-right tabular-nums font-bold text-gray-800">
                {products.filter((_, i) => checkedItems.has(i)).reduce((sum, item) => sum + item.selling_price, 0).toLocaleString()}
              </td>
              <td colSpan={3}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Trade-ins */}
      {tradeIns.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6 max-w-md">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">{t.quotation_trade_ins}</h3>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-50">
              {tradeIns.map((item, i) => (
                <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">{item.name}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-gray-700">{item.purchase_price.toLocaleString()}</td>
                </tr>
              ))}
              <tr className="bg-gray-50/80">
                <td className="px-5 py-3 font-semibold text-gray-700">{t.quotation_total_trade_in}</td>
                <td className="px-5 py-3 text-right font-bold tabular-nums text-gray-800">{q.total_trade_in.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Returns */}
      {q.returns.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">{t.return_history}</h3>
            <button onClick={openAddReturn}
              className="inline-flex items-center gap-1.5 bg-orange-600 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-orange-700 transition-colors shadow-sm">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              {t.return_add}
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.return_item_name}</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.return_reason}</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t.return_selling_price}</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t.return_refund_percent}</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t.return_refund_amount}</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.return_date}</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {q.returns.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{r.item_name}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                      r.reason === "seller_fault" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                    }`}>
                      {r.reason === "seller_fault" ? t.return_reason_seller : t.return_reason_customer}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{r.selling_price.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{r.refund_percent}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium text-orange-600">{r.refund_amount.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-gray-500">{formatDate(r.date)}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => openEditReturn(r)} className="text-gray-400 hover:text-blue-600 mr-2" title={t.return_edit}>
                      <svg className="w-3.5 h-3.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    <button onClick={() => handleDeleteReturn(r.id)} className="text-gray-400 hover:text-red-600" title={t.return_delete}>
                      <svg className="w-3.5 h-3.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50/80 border-t border-gray-100">
                <td colSpan={4} className="px-4 py-2.5 font-semibold text-gray-700">{t.return_total_refund}</td>
                <td className="px-4 py-2.5 text-right font-bold tabular-nums text-orange-600">{q.total_refund.toLocaleString()}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Add return button when no returns yet */}
      {q.returns.length === 0 && (
        <div className="mb-6 hide-on-screenshot">
          <button onClick={openAddReturn}
            className="inline-flex items-center gap-1.5 border border-dashed border-gray-300 px-3.5 py-2 rounded-lg text-sm text-gray-500 hover:text-orange-600 hover:border-orange-300 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            {t.return_add}
          </button>
        </div>
      )}

      {/* Payment History + Summary — side by side */}
      <div className="grid grid-cols-2 gap-6">
        {/* Payment History */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">{t.payment_history}</h3>
            <button onClick={openAddPayment}
              className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-blue-700 transition-colors shadow-sm hide-on-screenshot">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              {t.payment_add}
            </button>
          </div>
          {q.payments.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">{t.dash}</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.payment_type}</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t.payment_amount}</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.payment_method}</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.payment_date}</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {q.payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        p.payment_type === "refund" ? "bg-orange-50 text-orange-700" : "bg-emerald-50 text-emerald-700"
                      }`}>
                        {p.payment_type === "refund" ? t.payment_type_refund : t.payment_type_payment}
                      </span>
                    </td>
                    <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${p.payment_type === "refund" ? "text-orange-600" : "text-gray-800"}`}>
                      {p.payment_type === "refund" ? "-" : ""}{p.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        p.method === "transfer" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"
                      }`}>
                        {p.method === "transfer" ? t.payment_method_transfer : t.payment_method_cash}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">{formatDate(p.date)}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => openEditPayment(p)} className="text-gray-400 hover:text-blue-600 mr-2" title={t.payment_edit}>
                        <svg className="w-3.5 h-3.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                      <button onClick={() => handleDeletePayment(p.id)} className="text-gray-400 hover:text-red-600" title={t.payment_delete}>
                        <svg className="w-3.5 h-3.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50/80 border-t border-gray-100">
                  <td className="px-5 py-2.5 font-semibold text-gray-700">{t.payment_total}</td>
                  <td className="px-4 py-2.5 text-right font-bold tabular-nums text-emerald-600">{q.total_paid.toLocaleString()}</td>
                  <td colSpan={3}></td>
                </tr>
                {q.total_refund_paid > 0 && (
                  <tr className="bg-gray-50/80">
                    <td className="px-5 py-2.5 font-semibold text-gray-700">{t.payment_total_refund}</td>
                    <td className="px-4 py-2.5 text-right font-bold tabular-nums text-orange-600">-{q.total_refund_paid.toLocaleString()}</td>
                    <td colSpan={3}></td>
                  </tr>
                )}
              </tfoot>
            </table>
          )}
        </div>

        {/* Summary */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">{t.quotation_summary}</h3>
          </div>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-gray-50 hide-on-screenshot">
                <td className="px-5 py-3 text-gray-600">{t.quotation_total_cost}</td>
                <td className="px-5 py-3 text-right tabular-nums text-gray-700">{showCost ? q.total_purchase.toLocaleString() : "•••"}</td>
              </tr>
              <tr className="border-b border-gray-50 bg-blue-50/30">
                <td className="px-5 py-3 font-semibold text-gray-800">{t.quotation_total_selling}</td>
                <td className="px-5 py-3 text-right font-bold tabular-nums text-gray-800">{q.total_amount.toLocaleString()}</td>
              </tr>
              <tr className="border-b border-gray-50">
                <td className="px-5 py-3 text-gray-600">{t.quotation_paid}</td>
                <td className="px-5 py-3 text-right tabular-nums text-emerald-600">{q.total_paid.toLocaleString()}</td>
              </tr>
              {q.total_trade_in > 0 && (
                <tr className="border-b border-gray-50">
                  <td className="px-5 py-3 text-gray-600">{t.quotation_trade_in}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-gray-700">{q.total_trade_in.toLocaleString()}</td>
                </tr>
              )}
              {q.total_refund > 0 && (
                <tr className="border-b border-gray-50">
                  <td className="px-5 py-3 text-gray-600">{t.return_total_refund}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-orange-600">-{q.total_refund.toLocaleString()}</td>
                </tr>
              )}
              {q.total_refund_paid > 0 && (
                <tr className="border-b border-gray-50">
                  <td className="px-5 py-3 text-gray-600">{t.payment_refunded}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-orange-600">-{q.total_refund_paid.toLocaleString()}</td>
                </tr>
              )}
              <tr className="border-b border-gray-50 bg-red-50/50">
                <td className="px-5 py-3.5 font-semibold text-gray-800">{t.quotation_remaining}</td>
                <td className={`px-5 py-3.5 text-right font-bold tabular-nums text-lg ${q.remaining > 0 ? "text-red-600" : "text-emerald-600"}`}>{q.remaining.toLocaleString()}</td>
              </tr>
              <tr className="hide-on-screenshot">
                <td className="px-5 py-3 text-gray-600">{t.quotation_profit}</td>
                <td className={`px-5 py-3 text-right font-semibold tabular-nums ${q.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{showCost ? q.profit.toLocaleString() : "•••"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowPaymentModal(false)}>
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{editingPayment ? t.payment_edit : t.payment_add}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">{t.payment_type} *</label>
                <select
                  value={paymentForm.payment_type}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_type: e.target.value as PaymentType })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="payment">{t.payment_type_payment}</option>
                  <option value="refund">{t.payment_type_refund}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">{t.payment_amount} *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: formatNumber(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">{t.payment_method} *</label>
                <select
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value as PaymentMethod })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="cash">{t.payment_method_cash}</option>
                  <option value="transfer">{t.payment_method_transfer}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">{t.payment_date}</label>
                <input
                  type="date"
                  value={paymentForm.date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">{t.payment_note}</label>
                <input
                  type="text"
                  value={paymentForm.note}
                  onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowPaymentModal(false)}
                className="border border-gray-200 px-3.5 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors">{t.cancel}</button>
              <button onClick={handlePaymentSubmit}
                className="bg-blue-600 text-white px-3.5 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors shadow-sm">{t.save}</button>
            </div>
          </div>
        </div>
      )}
      {/* Return Modal */}
      {showReturnModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowReturnModal(false)}>
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{editingReturn ? t.return_edit : t.return_add}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">{t.return_item_name} *</label>
                <select value={returnForm.item_name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const product = products.find((p) => p.name === name);
                    setReturnForm({ ...returnForm, item_name: name, selling_price: product ? formatNumber(product.selling_price) : returnForm.selling_price });
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white">
                  <option value="">--</option>
                  {products.filter((p) => !returnedNames.has(p.name) || (editingReturn && editingReturn.item_name === p.name)).map((p, i) => (
                    <option key={i} value={p.name}>{p.name} — {p.selling_price.toLocaleString()}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">{t.return_reason} *</label>
                <select value={returnForm.reason}
                  onChange={(e) => {
                    const reason = e.target.value as ReturnReason;
                    setReturnForm({ ...returnForm, reason, refund_percent: reason === "seller_fault" ? "100" : "80" });
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white">
                  <option value="seller_fault">{t.return_reason_seller}</option>
                  <option value="customer_fault">{t.return_reason_customer}</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">{t.return_selling_price} *</label>
                  <input type="text" inputMode="numeric" value={returnForm.selling_price}
                    onChange={(e) => setReturnForm({ ...returnForm, selling_price: formatNumber(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">{t.return_refund_percent}</label>
                  <div className="relative">
                    <input type="number" min="0" max="100" value={returnForm.refund_percent}
                      onChange={(e) => setReturnForm({ ...returnForm, refund_percent: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                  </div>
                </div>
              </div>
              {parseNumber(returnForm.selling_price) > 0 && (
                <div className="bg-orange-50 rounded-lg px-3 py-2 text-sm">
                  <span className="text-gray-600">{t.return_refund_amount}: </span>
                  <span className="font-bold text-orange-600">
                    {Math.round(parseNumber(returnForm.selling_price) * (parseInt(returnForm.refund_percent) || 0) / 100).toLocaleString()}
                  </span>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">{t.return_date}</label>
                <input type="date" value={returnForm.date}
                  onChange={(e) => setReturnForm({ ...returnForm, date: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">{t.return_note}</label>
                <input type="text" value={returnForm.note}
                  onChange={(e) => setReturnForm({ ...returnForm, note: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowReturnModal(false)}
                className="border border-gray-200 px-3.5 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors">{t.cancel}</button>
              <button onClick={handleReturnSubmit}
                className="bg-orange-600 text-white px-3.5 py-2 rounded-lg text-sm hover:bg-orange-700 transition-colors shadow-sm">{t.save}</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
