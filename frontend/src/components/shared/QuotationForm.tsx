"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { formatNumber, parseNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
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
  const t = useT();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState(initialCustomer?.name || "");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(initialCustomer || null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [customerName, setCustomerName] = useState(initialCustomer?.name || "");
  const [customerPhone, setCustomerPhone] = useState(initialCustomer?.phone || "");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<QuotationItem[]>(
    initialItems?.filter((i) => !i.is_trade_in) || [{ ...EMPTY_ITEM }]
  );
  const [tradeIns, setTradeIns] = useState<QuotationItem[]>(
    initialItems?.filter((i) => i.is_trade_in) || []
  );
  const [totalPaidDisplay, setTotalPaidDisplay] = useState(initialPaid ? formatNumber(initialPaid) : "0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode === "create") {
      apiFetch<PaginatedResponse<Customer>>("/api/customers?limit=100").then((r) => setCustomers(r.items));
    }
  }, [mode]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.phone && c.phone.includes(customerSearch))
  );

  const isNewCustomer = !selectedCustomer && customerSearch.trim().length > 0;

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
        if (selectedCustomer) {
          payload.customer_id = selectedCustomer.id;
        } else {
          payload.new_customer = { name: customerName || customerSearch, phone: customerPhone || null };
        }
        const res = await apiFetch<{ id: number }>("/api/quotations", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        router.push(`/quotations/${res.id}`);
      } else {
        await apiFetch(`/api/quotations/${quotationId}`, {
          method: "PUT",
          body: JSON.stringify({ total_paid: parseNumber(totalPaidDisplay), items: allItems }),
        });
        router.push(`/quotations/${quotationId}`);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : t.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {mode === "create" && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">{t.form_customer}</h3>
          <div className="relative mb-4" ref={dropdownRef}>
            <label className="block text-sm font-medium text-gray-600 mb-1">{t.form_customer_required}</label>
            <div className="relative">
              <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={selectedCustomer ? selectedCustomer.name : customerSearch}
                onChange={(e) => { setCustomerSearch(e.target.value); setCustomerName(e.target.value); setSelectedCustomer(null); setShowDropdown(true); }}
                onFocus={() => { if (!selectedCustomer) setShowDropdown(true); }}
                placeholder={t.form_customer_search}
                className="border border-gray-200 rounded-lg pl-9 pr-8 py-2.5 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
                required
              />
              {selectedCustomer && (
                <button type="button" onClick={() => { setSelectedCustomer(null); setCustomerSearch(""); setCustomerPhone(""); setShowDropdown(true); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
            {showDropdown && !selectedCustomer && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-auto">
                {filteredCustomers.length > 0 ? filteredCustomers.map((c) => (
                  <button key={c.id} type="button"
                    onClick={() => { setSelectedCustomer(c); setCustomerSearch(c.name); setCustomerPhone(c.phone || ""); setShowDropdown(false); }}
                    className="w-full text-left px-3 py-2.5 hover:bg-blue-50 text-sm flex justify-between items-center transition-colors border-b border-gray-50 last:border-0">
                    <div><span className="font-medium text-gray-800">{c.name}</span>{c.phone && <span className="text-gray-400 ml-2 text-xs">{c.phone}</span>}</div>
                    {c.email && <span className="text-gray-300 text-xs">{c.email}</span>}
                  </button>
                )) : customerSearch.trim() ? (
                  <div className="px-3 py-3 text-sm text-gray-400 text-center">{t.form_customer_not_found}</div>
                ) : (
                  <div className="px-3 py-3 text-sm text-gray-400 text-center">{t.form_customer_type_to_search}</div>
                )}
              </div>
            )}
            {isNewCustomer && !showDropdown && (
              <span className="text-xs text-amber-600 mt-1 block">{t.form_customer_new_hint}</span>
            )}
          </div>

          {(selectedCustomer || customerSearch.trim()) && (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">{t.form_phone}</label>
                <input value={selectedCustomer?.phone || customerPhone} onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder={t.form_phone_number}
                  className={`border border-gray-200 rounded-lg px-3 py-2.5 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors ${selectedCustomer ? "bg-gray-50 text-gray-500" : ""}`}
                  disabled={!!selectedCustomer} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">{t.form_email}</label>
                <input value={selectedCustomer?.email || ""} placeholder={t.dash}
                  className="border border-gray-200 rounded-lg px-3 py-2.5 w-full text-sm bg-gray-50 text-gray-500" disabled />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">{t.form_address}</label>
                <input value={selectedCustomer?.address || ""} placeholder={t.dash}
                  className="border border-gray-200 rounded-lg px-3 py-2.5 w-full text-sm bg-gray-50 text-gray-500" disabled />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex justify-between items-center px-5 py-3 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">{t.form_products}</h3>
          <button type="button" onClick={() => setItems([...items, { ...EMPTY_ITEM }])}
            className="inline-flex items-center gap-1 text-blue-600 text-sm font-medium hover:text-blue-700 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            {t.form_add_line}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.form_col_name}</th>
                <th className="px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">{t.form_col_cond}</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t.form_col_cost}</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t.form_col_price}</th>
                <th className="px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">{t.form_col_warranty}</th>
                <th className="px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">{t.form_col_warranty_date}</th>
                <th className="px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">{t.form_col_notes}</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((item, i) => (
                <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-2 py-2"><input value={item.name} onChange={(e) => updateItem(i, "name", e.target.value)} className="border border-gray-200 rounded-lg px-2.5 py-1.5 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" required /></td>
                  <td className="px-2 py-2"><select value={item.condition || "2nd"} onChange={(e) => updateItem(i, "condition", e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white"><option value="2nd">2nd</option><option value="new">New</option></select></td>
                  <td className="px-2 py-2"><input type="text" inputMode="numeric" value={formatNumber(item.purchase_price)} onChange={(e) => updateItem(i, "purchase_price", parseNumber(e.target.value))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 w-24 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" /></td>
                  <td className="px-2 py-2"><input type="text" inputMode="numeric" value={formatNumber(item.selling_price)} onChange={(e) => updateItem(i, "selling_price", parseNumber(e.target.value))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 w-24 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" /></td>
                  <td className="px-2 py-2"><input value={item.warranty || ""} onChange={(e) => updateItem(i, "warranty", e.target.value)} className="border border-gray-200 rounded-lg px-2.5 py-1.5 w-16 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" /></td>
                  <td className="px-2 py-2"><input type="date" value={item.warranty_start || ""} onChange={(e) => updateItem(i, "warranty_start", e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" /></td>
                  <td className="px-2 py-2"><input value={item.notes || ""} onChange={(e) => updateItem(i, "notes", e.target.value)} className="border border-gray-200 rounded-lg px-2.5 py-1.5 w-24 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" /></td>
                  <td className="px-2 py-2"><button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} className="p-1 rounded-md hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex justify-between items-center px-5 py-3 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">{t.form_trade_ins}</h3>
          <button type="button" onClick={() => setTradeIns([...tradeIns, { ...EMPTY_TRADE_IN }])}
            className="inline-flex items-center gap-1 text-blue-600 text-sm font-medium hover:text-blue-700 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            {t.form_add_trade_in}
          </button>
        </div>
        {tradeIns.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.quotation_col_name}</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t.form_trade_in_price}</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tradeIns.map((item, i) => (
                <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-2 py-2"><input value={item.name} onChange={(e) => updateTradeIn(i, "name", e.target.value)} className="border border-gray-200 rounded-lg px-2.5 py-1.5 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" /></td>
                  <td className="px-2 py-2"><input type="text" inputMode="numeric" value={formatNumber(item.purchase_price)} onChange={(e) => updateTradeIn(i, "purchase_price", parseNumber(e.target.value))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 w-32 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" /></td>
                  <td className="px-2 py-2"><button type="button" onClick={() => setTradeIns(tradeIns.filter((_, j) => j !== i))} className="p-1 rounded-md hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-5 py-6 text-center text-gray-400 text-sm">{t.form_no_trade_ins}</div>
        )}
      </div>

      {mode === "edit" && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <label className="block text-sm font-medium text-gray-600 mb-1">{t.form_amount_paid}</label>
          <input type="text" inputMode="numeric" value={totalPaidDisplay} onChange={(e) => setTotalPaidDisplay(formatNumber(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-2.5 w-48 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
        </div>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm">
          {saving ? t.saving : mode === "create" ? t.form_create : t.form_update}
        </button>
        <button type="button" onClick={() => router.back()}
          className="border border-gray-200 px-4 py-2.5 rounded-lg text-sm hover:bg-gray-50 transition-colors">{t.cancel}</button>
      </div>
    </form>
  );
}
