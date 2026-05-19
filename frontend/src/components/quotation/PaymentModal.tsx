"use client";

import { useState } from "react";
import DateInput from "@/components/shared/DateInput";
import { formatNumber, parseNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { Payment, PaymentMethod, PaymentType } from "@/types";

export interface PaymentSubmitBody {
  amount: number;
  method: PaymentMethod;
  payment_type: PaymentType;
  date: string;
  note: string | null;
}

interface Props {
  initial: Payment | null;
  onClose: () => void;
  onSubmit: (body: PaymentSubmitBody) => Promise<void>;
}

export default function PaymentModal({ initial, onClose, onSubmit }: Props) {
  const t = useT();
  const [amount, setAmount] = useState(() => (initial ? formatNumber(initial.amount) : ""));
  const [method, setMethod] = useState<PaymentMethod>(() => initial?.method ?? "transfer");
  const [paymentType, setPaymentType] = useState<PaymentType>(() => initial?.payment_type ?? "payment");
  const [date, setDate] = useState(() => initial?.date ?? new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState(() => initial?.note ?? "");

  async function handleSave() {
    await onSubmit({
      amount: parseNumber(amount),
      method,
      payment_type: paymentType,
      date,
      note: note || null,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{initial ? t.payment_edit : t.payment_add}</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">{t.payment_type} *</label>
            <select
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value as PaymentType)}
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
              value={amount}
              onChange={(e) => setAmount(formatNumber(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">{t.payment_method} *</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="cash">{t.payment_method_cash}</option>
              <option value="transfer">{t.payment_method_transfer}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">{t.payment_date}</label>
            <DateInput
              value={date}
              onChange={setDate}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">{t.payment_note}</label>
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
            className="bg-blue-600 text-white px-3.5 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors shadow-sm"
          >
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
}
