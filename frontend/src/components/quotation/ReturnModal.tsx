"use client";

import { useState } from "react";
import DateInput from "@/components/shared/DateInput";
import { formatNumber, parseNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { QuotationItem, Return, ReturnReason } from "@/types";

export interface ReturnSubmitBody {
  item_name: string;
  reason: ReturnReason;
  selling_price: number;
  refund_percent: number;
  date: string;
  note: string | null;
}

interface Props {
  initial: Return | null;
  products: QuotationItem[];
  returnedNames: Set<string>;
  onClose: () => void;
  onSubmit: (body: ReturnSubmitBody) => Promise<void>;
}

export default function ReturnModal({
  initial,
  products,
  returnedNames,
  onClose,
  onSubmit,
}: Props) {
  const t = useT();
  const [itemName, setItemName] = useState(() => initial?.item_name ?? "");
  const [reason, setReason] = useState<ReturnReason>(() => initial?.reason ?? "seller_fault");
  const [sellingPrice, setSellingPrice] = useState(() =>
    initial ? formatNumber(initial.selling_price) : "",
  );
  const [refundPercent, setRefundPercent] = useState(() =>
    initial ? String(initial.refund_percent) : "100",
  );
  const [date, setDate] = useState(() => initial?.date ?? new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState(() => initial?.note ?? "");

  function handleItemChange(name: string) {
    setItemName(name);
    const product = products.find((p) => p.name === name);
    if (product) setSellingPrice(formatNumber(product.selling_price));
  }

  function handleReasonChange(next: ReturnReason) {
    setReason(next);
    setRefundPercent(next === "seller_fault" ? "100" : "80");
  }

  async function handleSave() {
    await onSubmit({
      item_name: itemName,
      reason,
      selling_price: parseNumber(sellingPrice),
      refund_percent: parseInt(refundPercent) || 0,
      date,
      note: note || null,
    });
  }

  const previewRefund = Math.round(
    (parseNumber(sellingPrice) * (parseInt(refundPercent) || 0)) / 100,
  );

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{initial ? t.return_edit : t.return_add}</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">{t.return_item_name} *</label>
            <select
              value={itemName}
              onChange={(e) => handleItemChange(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="">--</option>
              {products
                .filter((p) => !returnedNames.has(p.name) || (initial !== null && initial.item_name === p.name))
                .map((p) => (
                  <option key={p.id ?? p.name} value={p.name}>
                    {p.name} — {p.selling_price.toLocaleString()}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">{t.return_reason} *</label>
            <select
              value={reason}
              onChange={(e) => handleReasonChange(e.target.value as ReturnReason)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="seller_fault">{t.return_reason_seller}</option>
              <option value="customer_fault">{t.return_reason_customer}</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">{t.return_selling_price} *</label>
              <input
                type="text"
                inputMode="numeric"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(formatNumber(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">{t.return_refund_percent}</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={refundPercent}
                  onChange={(e) => setRefundPercent(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
              </div>
            </div>
          </div>
          {parseNumber(sellingPrice) > 0 && (
            <div className="bg-orange-50 rounded-lg px-3 py-2 text-sm">
              <span className="text-gray-600">{t.return_refund_amount}: </span>
              <span className="font-bold text-orange-600">{previewRefund.toLocaleString()}</span>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">{t.return_date}</label>
            <DateInput
              value={date}
              onChange={setDate}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">{t.return_note}</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="border border-gray-200 px-3.5 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            {t.cancel}
          </button>
          <button
            onClick={handleSave}
            className="bg-orange-600 text-white px-3.5 py-2 rounded-lg text-sm hover:bg-orange-700 transition-colors shadow-sm"
          >
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
}
