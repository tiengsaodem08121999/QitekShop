"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/api";
import { formatDate, formatNumber, parseNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { apiError } from "@/lib/apiError";
import { useToast } from "@/components/Toast";
import ProductsTable from "@/components/quotation/ProductsTable";
import PaymentModal, { type PaymentSubmitBody } from "@/components/quotation/PaymentModal";
import ReturnModal, { type ReturnSubmitBody } from "@/components/quotation/ReturnModal";
import QuotationStatusBadge from "@/components/quotation/QuotationStatusBadge";
import { useConfirm } from "@/components/Confirm";
import type { Payment, Quotation, Return } from "@/types";

export default function QuotationDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const confirm = useConfirm();
  const contentRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState<Quotation | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [showCost, setShowCost] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [editingResaleId, setEditingResaleId] = useState<number | null>(null);
  const [resaleDraft, setResaleDraft] = useState("");
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [editingReturn, setEditingReturn] = useState<Return | null>(null);

  useEffect(() => {
    apiFetch<Quotation>(`/api/quotations/${id}`)
      .then(setQ)
      .catch((err) => toast(apiError(err, t), "error"));
  }, [id, toast, t.error]);

  async function handleConfirm() {
    if (!(await confirm(t.quotation_confirm_prompt))) return;
    try {
      const updated = await apiFetch<Quotation>(`/api/quotations/${id}/confirm`, { method: "PATCH" });
      setQ(updated);
    } catch (err) {
      toast(apiError(err, t), "error");
    }
  }

  async function handleDeliver() {
    if (!(await confirm(t.quotation_deliver_confirm))) return;
    try {
      const updated = await apiFetch<Quotation>(`/api/quotations/${id}/deliver`, { method: "PATCH" });
      setQ(updated);
    } catch (err) {
      toast(apiError(err, t), "error");
    }
  }

  async function handleImportTradeIns() {
    try {
      const updated = await apiFetch<Quotation>(`/api/quotations/${id}/import-trade-ins`, { method: "PATCH" });
      setQ(updated);
      toast(t.toast_update_success);
    } catch (err) {
      toast(apiError(err, t), "error");
    }
  }

  async function handleDelete() {
    if (!(await confirm(t.quotation_delete_prompt))) return;
    try {
      await apiFetch(`/api/quotations/${id}`, { method: "DELETE" });
      toast(t.quotation_delete_success);
      router.push("/quotations");
    } catch (err) {
      toast(apiError(err, t), "error");
    }
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
    if (!contentRef.current || !q) return;
    contentRef.current.classList.add("screenshot-mode");
    const { default: html2canvas } = await import("html2canvas-pro");
    const canvas = await html2canvas(contentRef.current, { backgroundColor: "#f3f4f6", scale: 2 });
    contentRef.current.classList.remove("screenshot-mode");
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    const safeName = q.customer.name.replace(/[\\/:*?"<>|]/g, "").trim() || `quotation-${id}`;
    a.download = `${safeName}.png`;
    a.click();
  }

  async function saveResale(itemId: number) {
    const parsed = parseNumber(resaleDraft);
    if (parsed < 0) {
      toast(t.error, "error");
      setEditingResaleId(null);
      return;
    }
    try {
      const updated = await apiFetch<Quotation>(
        `/api/quotations/${id}/items/${itemId}/resale`,
        { method: "PATCH", body: JSON.stringify({ resale_price: parsed }) },
      );
      setQ(updated);
      setEditingResaleId(null);
    } catch (err: unknown) {
      toast(apiError(err, t), "error");
    }
  }

  function startEditingResale(item: { id?: number; resale_price: number }) {
    if (!item.id) return;
    setEditingResaleId(item.id);
    setResaleDraft(formatNumber(item.resale_price));
  }

  function openAddPayment() {
    setEditingPayment(null);
    setShowPaymentModal(true);
  }

  function openEditPayment(p: Payment) {
    setEditingPayment(p);
    setShowPaymentModal(true);
  }

  async function finishPayment() {
    setShowPaymentModal(false);
    toast(editingPayment ? "Cập nhật thanh toán thành công" : "Thêm thanh toán thành công");
    setQ(await apiFetch<Quotation>(`/api/quotations/${id}`));
  }

  async function handlePaymentSubmit(body: PaymentSubmitBody) {
    try {
      if (editingPayment) {
        await apiFetch(`/api/quotations/${id}/payments/${editingPayment.id}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await apiFetch(`/api/quotations/${id}/payments`, { method: "POST", body: JSON.stringify(body) });
      }
      await finishPayment();
    } catch (err) {
      // Conflicting items held by another quotation: offer to unlink them (virtual items) and proceed.
      if (!editingPayment && err instanceof Error && err.message === "err_payment_conflict") {
        if (await confirm(t.payment_conflict_unlink_prompt)) {
          try {
            await apiFetch(`/api/quotations/${id}/payments`, {
              method: "POST",
              body: JSON.stringify({ ...body, unlink_conflicts: true }),
            });
            await finishPayment();
          } catch (e2) {
            toast(apiError(e2, t), "error");
          }
        }
        return;
      }
      toast(apiError(err, t), "error");
    }
  }

  async function handleDeletePayment(paymentId: number) {
    if (!(await confirm(t.payment_confirm_delete))) return;
    try {
      await apiFetch(`/api/quotations/${id}/payments/${paymentId}`, { method: "DELETE" });
      toast("Xóa thanh toán thành công");
      const updated = await apiFetch<Quotation>(`/api/quotations/${id}`);
      setQ(updated);
    } catch (err) {
      toast(apiError(err, t), "error");
    }
  }

  function openAddReturn() {
    setEditingReturn(null);
    setShowReturnModal(true);
  }

  function openEditReturn(r: Return) {
    setEditingReturn(r);
    setShowReturnModal(true);
  }

  async function handleReturnSubmit(body: ReturnSubmitBody) {
    try {
      if (editingReturn) {
        await apiFetch(`/api/quotations/${id}/returns/${editingReturn.id}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await apiFetch(`/api/quotations/${id}/returns`, { method: "POST", body: JSON.stringify(body) });
      }
      setShowReturnModal(false);
      toast(editingReturn ? "Cập nhật trả hàng thành công" : "Thêm trả hàng thành công");
      const updated = await apiFetch<Quotation>(`/api/quotations/${id}`);
      setQ(updated);
    } catch (err) {
      toast(apiError(err, t), "error");
    }
  }

  async function handleDeleteReturn(returnId: number) {
    if (!(await confirm(t.return_confirm_delete))) return;
    try {
      await apiFetch(`/api/quotations/${id}/returns/${returnId}`, { method: "DELETE" });
      toast("Xóa trả hàng thành công");
      const updated = await apiFetch<Quotation>(`/api/quotations/${id}`);
      setQ(updated);
    } catch (err) {
      toast(apiError(err, t), "error");
    }
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
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-800">{q.customer.name}</h1>
              <QuotationStatusBadge status={q.status} />
            </div>
            <p className="text-sm text-gray-400 mt-0.5">#{q.id} &middot; {formatDate(q.created_at)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {q.status === "confirmed" && (
            <button onClick={handleDeliver}
              className="inline-flex items-center gap-1.5 bg-emerald-600 text-white px-3.5 py-2 rounded-lg text-sm hover:bg-emerald-700 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              {t.quotation_deliver}
            </button>
          )}
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
          <button onClick={handleDelete} disabled={!q.deletable}
            title={q.deletable ? t.quotation_delete : t.quotation_delete_blocked}
            className="inline-flex items-center gap-1.5 border border-red-200 text-red-600 px-3.5 py-2 rounded-lg text-sm hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            {t.quotation_delete}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className={`grid gap-4 mb-6 ${showCost ? "grid-cols-5" : "grid-cols-3"}`}>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">{t.quotation_total_selling}</p>
          <p className="text-xl font-bold text-gray-800 mt-1">{q.total_amount.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">{t.quotation_paid}</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{q.total_paid.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">{q.remaining < 0 ? t.quotation_overpaid : t.quotation_remaining}</p>
          <p className={`text-xl font-bold mt-1 ${q.remaining > 0 ? "text-red-600" : q.remaining < 0 ? "text-amber-600" : "text-emerald-600"}`}>{Math.abs(q.remaining).toLocaleString()}</p>
        </div>
        {showCost && (
          <>
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{t.quotation_profit}</p>
              <p className={`text-xl font-bold mt-1 ${q.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{q.profit.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{t.quotation_cashflow}</p>
              <p className={`text-xl font-bold mt-1 ${q.cashflow >= 0 ? "text-emerald-600" : "text-red-600"}`}>{q.cashflow.toLocaleString()}</p>
            </div>
          </>
        )}
      </div>

      <div ref={contentRef}>
      {/* Products table */}
      <ProductsTable
        products={products}
        returnedNames={returnedNames}
        customerName={q.customer.name}
        showCost={showCost}
        onToggleShowCost={() => setShowCost(!showCost)}
        checkedItems={checkedItems}
        onCheckedItemsChange={setCheckedItems}
      />

      {/* Trade-ins */}
      {tradeIns.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6 max-w-2xl">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">{t.quotation_trade_ins}</h3>
            <button onClick={handleImportTradeIns}
              className="inline-flex items-center gap-1 text-emerald-600 text-sm font-medium hover:text-emerald-700 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
              {t.form_import_stock}
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-12">{t.form_col_stt}</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.quotation_col_name}</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.quotation_col_serial}</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t.form_trade_in_price}</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider hide-on-screenshot">{t.quotation_resale_price}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tradeIns.map((item, i) => (
                <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-center text-xs text-gray-400 tabular-nums">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{item.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{item.serial_number || t.dash}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">{item.purchase_price.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700 hide-on-screenshot">
                    {!showCost ? (
                      "•••"
                    ) : editingResaleId === item.id ? (
                      <input
                        autoFocus
                        type="text"
                        inputMode="numeric"
                        value={resaleDraft}
                        onChange={(e) => setResaleDraft(formatNumber(e.target.value))}
                        onBlur={() => saveResale(item.id!)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); saveResale(item.id!); }
                          if (e.key === "Escape") { e.preventDefault(); setEditingResaleId(null); }
                        }}
                        className="border border-blue-300 rounded px-2 py-1 w-32 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEditingResale(item)}
                        className="hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                        title={t.quotation_resale_price}
                      >
                        {item.resale_price.toLocaleString()}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50/80">
                <td colSpan={3} className="px-5 py-3 font-semibold text-gray-700">{t.quotation_total_trade_in}</td>
                <td className="px-5 py-3 text-right font-bold tabular-nums text-gray-800">{q.total_trade_in.toLocaleString()}</td>
                <td className="px-5 py-3 text-right font-bold tabular-nums text-gray-800 hide-on-screenshot">{showCost ? q.total_trade_in_resale.toLocaleString() : "•••"}</td>
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
                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider hide-on-screenshot"></th>
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
                  <td className="px-4 py-2.5 text-right whitespace-nowrap hide-on-screenshot">
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
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider hide-on-screenshot"></th>
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
                    <td className="px-4 py-2.5 text-right whitespace-nowrap hide-on-screenshot">
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
              {q.total_trade_in_resale > 0 && (
                <tr className="border-b border-gray-50 hide-on-screenshot">
                  <td className="px-5 py-3 text-gray-600">{t.quotation_total_trade_in_resold}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-emerald-600">+{q.total_trade_in_resale.toLocaleString()}</td>
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
              <tr className={`border-b border-gray-50 ${q.remaining < 0 ? "bg-amber-50/50" : "bg-red-50/50"}`}>
                <td className="px-5 py-3.5 font-semibold text-gray-800">{q.remaining < 0 ? t.quotation_overpaid : t.quotation_remaining}</td>
                <td className={`px-5 py-3.5 text-right font-bold tabular-nums text-lg ${q.remaining > 0 ? "text-red-600" : q.remaining < 0 ? "text-amber-600" : "text-emerald-600"}`}>{Math.abs(q.remaining).toLocaleString()}</td>
              </tr>
              <tr className="hide-on-screenshot">
                <td className="px-5 py-3 text-gray-600">{t.quotation_profit}</td>
                <td className={`px-5 py-3 text-right font-semibold tabular-nums ${q.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{showCost ? q.profit.toLocaleString() : "•••"}</td>
              </tr>
              <tr className="hide-on-screenshot">
                <td className="px-5 py-3 text-gray-600">{t.quotation_cashflow}</td>
                <td className={`px-5 py-3 text-right font-semibold tabular-nums ${q.cashflow >= 0 ? "text-emerald-600" : "text-red-600"}`}>{showCost ? q.cashflow.toLocaleString() : "•••"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      </div>

      {q.note && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mt-6">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">{t.quotation_note_label}</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{q.note}</p>
        </div>
      )}

      {showPaymentModal && (
        <PaymentModal
          initial={editingPayment}
          onClose={() => setShowPaymentModal(false)}
          onSubmit={handlePaymentSubmit}
        />
      )}
      {showReturnModal && (
        <ReturnModal
          initial={editingReturn}
          products={products}
          returnedNames={returnedNames}
          onClose={() => setShowReturnModal(false)}
          onSubmit={handleReturnSubmit}
        />
      )}
    </AppLayout>
  );
}
