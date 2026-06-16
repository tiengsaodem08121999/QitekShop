"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { formatNumber, parseNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { apiError } from "@/lib/apiError";
import { useToast } from "@/components/Toast";
import { isWarrantyActive } from "@/lib/format";
import DateInput from "@/components/shared/DateInput";
import type { Customer, InventoryItem, PaginatedResponse, QuotationItem, QuotationStatus, WarrantyUnit } from "@/types";

interface Props {
  mode: "create" | "edit";
  quotationId?: number;
  initialCustomer?: Customer;
  initialItems?: QuotationItem[];
  initialNote?: string | null;
  returnedNames?: Set<string>;
  status?: QuotationStatus;
}

const EMPTY_ITEM: QuotationItem = {
  is_trade_in: false, name: "", condition: "2nd",
  purchase_price: 0, selling_price: 0, resale_price: 0,
  serial_number: null, inventory_item_id: null,
  warranty_count: 1, warranty_unit: "month",
  warranty_start: null, delivery_date: null, notes: null,
};

const EMPTY_TRADE_IN: QuotationItem = {
  is_trade_in: true, name: "", condition: null,
  purchase_price: 0, selling_price: 0, resale_price: 0,
  serial_number: null, inventory_item_id: null,
  warranty_count: null, warranty_unit: null,
  warranty_start: null, delivery_date: null, notes: null,
};

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Fresh sale row: warranty defaults to 1 month, warranty date defaults to today.
function blankItem(): QuotationItem {
  return { ...EMPTY_ITEM, warranty_start: todayISO() };
}

export default function QuotationForm({ mode, quotationId, initialCustomer, initialItems, initialNote, returnedNames, status }: Props) {
  // Delivered quotations: sale lines locked to price/warranty/condition/note only
  // (no add/remove/relink). Trade-ins stay editable.
  const saleLocked = status === "delivered";
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState(initialCustomer?.name || "");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(initialCustomer || null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [customerName, setCustomerName] = useState(initialCustomer?.name || "");
  const [customerPhone, setCustomerPhone] = useState(initialCustomer?.phone || "");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<QuotationItem[]>(
    initialItems?.filter((i) => !i.is_trade_in) || [blankItem()]
  );
  const [tradeIns, setTradeIns] = useState<QuotationItem[]>(
    initialItems?.filter((i) => i.is_trade_in) || []
  );
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState(initialNote || "");
  const [stock, setStock] = useState<InventoryItem[]>([]);
  const [stockOpenRow, setStockOpenRow] = useState<number | null>(null);
  const nameCellRef = useRef<HTMLTableCellElement>(null);
  const [showSyncWarning, setShowSyncWarning] = useState(false);

  // Snapshot of trade-ins already linked to stock at load — used to detect when a
  // normal save would leave stock out of sync (a linked trade-in edited/removed).
  const initialLinkedTradeIns = useRef(
    new Map(
      (initialItems || [])
        .filter((i) => i.is_trade_in && i.inventory_item_id != null)
        .map((i) => [i.inventory_item_id as number, { name: i.name, purchase_price: i.purchase_price, resale_price: i.resale_price }]),
    ),
  );

  function tradeInStockMismatch(): boolean {
    const snap = initialLinkedTradeIns.current;
    if (snap.size === 0) return false;
    const currentLinked = new Map(
      tradeIns.filter((i) => i.inventory_item_id != null).map((i) => [i.inventory_item_id as number, i]),
    );
    for (const [id, s] of snap) {
      const cur = currentLinked.get(id);
      if (!cur) return true; // a linked trade-in was removed
      if (cur.name !== s.name || Number(cur.purchase_price) !== Number(s.purchase_price) || Number(cur.resale_price) !== Number(s.resale_price)) {
        return true; // a linked trade-in was edited
      }
    }
    return false;
  }

  useEffect(() => {
    apiFetch<PaginatedResponse<Customer>>("/api/customers?limit=100")
      .then((r) => setCustomers(r.items))
      .catch((err) => toast(apiError(err, t), "error"));
  }, [toast, t.error]);

  useEffect(() => {
    const url = quotationId
      ? `/api/inventory?available=true&limit=200&exclude_quotation_id=${quotationId}`
      : "/api/inventory?available=true&limit=200";
    apiFetch<PaginatedResponse<InventoryItem>>(url)
      .then((r) => setStock(r.items))
      .catch(() => {});
  }, [quotationId]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (nameCellRef.current && !nameCellRef.current.contains(e.target as Node)) {
        setStockOpenRow(null);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function pickStock(index: number, inv: InventoryItem) {
    setItems((prev) => prev.map((item, i) => i === index ? {
      ...item, name: inv.name, serial_number: inv.serial_number,
      purchase_price: inv.purchase_price, inventory_item_id: inv.id,
    } : item));
    setStockOpenRow(null);
  }

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

  function updateItem(index: number, field: string, value: string | number | null) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  // Editing the name unlinks the row from stock. If it was linked, the S/N was
  // carried over from the inventory item, so clear it too (a now-virtual line
  // shouldn't keep a stale serial). Manually-typed S/Ns on never-linked rows
  // are preserved.
  function handleNameChange(index: number, value: string) {
    setItems((prev) => prev.map((item, i) => {
      if (i !== index) return item;
      const wasLinked = item.inventory_item_id != null;
      return { ...item, name: value, inventory_item_id: null, ...(wasLinked ? { serial_number: null } : {}) };
    }));
    setStockOpenRow(index);
  }

  function handleTabDown(e: React.KeyboardEvent<HTMLInputElement>, col: string, row: number) {
    if (e.key === "Tab" && !e.shiftKey) {
      const next = e.currentTarget.closest("table")?.querySelector<HTMLInputElement>(`[data-col="${col}"][data-row="${row + 1}"]`);
      if (next) {
        e.preventDefault();
        next.focus();
        next.select();
      }
    }
  }

  function copyDown(field: "warranty" | "warranty_start") {
    if (field === "warranty") {
      const first = items[0];
      if (!first) return;
      const { warranty_count, warranty_unit } = first;
      if (warranty_count == null && warranty_unit == null) return;
      setItems((prev) => prev.map((item, i) =>
        i === 0 ? item : { ...item, warranty_count, warranty_unit }
      ));
      return;
    }
    const firstValue = items[0]?.[field];
    if (!firstValue) return;
    setItems((prev) => prev.map((item, i) => i === 0 ? item : { ...item, [field]: firstValue }));
  }

  function updateTradeIn(index: number, field: string, value: string | number | null) {
    setTradeIns((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function onFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (tradeInStockMismatch()) {
      setShowSyncWarning(true);
      return;
    }
    doSubmit(false);
  }

  async function doSubmit(importTradeIns: boolean) {
    setShowSyncWarning(false);
    setSaving(true);

    const validTradeIns = tradeIns.filter((i) => i.name.trim() !== "");
    const allItems = [
      ...items.map((i) => ({ ...i, is_trade_in: false, resale_price: 0, warranty_start: i.warranty_start || null })),
      ...validTradeIns.map((i) => ({ ...i, is_trade_in: true, selling_price: 0, condition: null })),
    ];

    try {
      if (mode === "create") {
        const payload: Record<string, unknown> = { items: allItems, import_trade_ins: importTradeIns, note: note || null };
        if (selectedCustomer) {
          payload.customer_id = selectedCustomer.id;
        } else {
          payload.new_customer = { name: customerName || customerSearch, phone: customerPhone || null };
        }
        const res = await apiFetch<{ id: number }>("/api/quotations", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast(t.toast_create_success);
        router.push(`/quotations/${res.id}`);
      } else {
        const payload: Record<string, unknown> = { items: allItems, import_trade_ins: importTradeIns, note: note || null };
        if (selectedCustomer && selectedCustomer.id !== initialCustomer?.id) {
          payload.customer_id = selectedCustomer.id;
        } else {
          payload.customer_name = customerName || customerSearch;
        }
        await apiFetch(`/api/quotations/${quotationId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast(t.toast_update_success);
        router.push(`/quotations/${quotationId}`);
      }
    } catch (err: unknown) {
      toast(apiError(err, t), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onFormSubmit} className="space-y-6">
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

          {mode === "create" && (selectedCustomer || customerSearch.trim()) && (
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

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex justify-between items-center px-5 py-3 border-b border-gray-100 bg-gray-50/50 rounded-t-xl">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">{t.form_products}</h3>
          {!saleLocked && (
            <button type="button" onClick={() => setItems([...items, blankItem()])}
              className="inline-flex items-center gap-1 text-blue-600 text-sm font-medium hover:text-blue-700 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              {t.form_add_line}
            </button>
          )}
        </div>
        <div className="overflow-x-visible">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="w-[4%] px-2 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{t.form_col_stt}</th>
                <th className="w-[13%] px-2 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.form_col_name}</th>
                <th className="w-[9%] px-2 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.form_col_serial}</th>
                <th className="w-[7%] px-2 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.form_col_cond}</th>
                <th className="w-[13%] px-2 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.form_col_cost}</th>
                <th className="w-[13%] px-2 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.form_col_price}</th>
                <th className="w-[12%] px-2 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center gap-1">
                    {t.form_col_warranty}
                    <button type="button" onClick={() => copyDown("warranty")} title="Copy dòng 1 xuống" className="p-0.5 rounded hover:bg-blue-50 text-gray-300 hover:text-blue-500 transition-colors">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                    </button>
                  </div>
                </th>
                <th className="w-[9%] px-2 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center gap-1">
                    {t.form_col_warranty_date}
                    <button type="button" onClick={() => copyDown("warranty_start")} title="Copy dòng 1 xuống" className="p-0.5 rounded hover:bg-blue-50 text-gray-300 hover:text-blue-500 transition-colors">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                    </button>
                  </div>
                </th>
                <th className="w-[5%] px-2 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{t.form_col_warranty_status}</th>
                <th className="w-[9%] px-2 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.form_col_notes}</th>
                <th className="w-[3%]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((item, i) => {
                const isReturned = returnedNames?.has(item.name);
                const nameLocked = isReturned || saleLocked;
                return (
                <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-2 py-2 text-center text-xs text-gray-400 tabular-nums">{i + 1}</td>
                  <td className="px-2 py-2 relative" ref={stockOpenRow === i ? nameCellRef : undefined}>
                    <input data-col="name" data-row={i} value={item.name}
                      onChange={(e) => handleNameChange(i, e.target.value)}
                      onFocus={() => { if (!nameLocked) setStockOpenRow(i); }}
                      onKeyDown={(e) => handleTabDown(e, "name", i)}
                      placeholder={t.form_stock_pick}
                      className={`border rounded-lg px-2.5 py-1.5 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 ${item.inventory_conflict ? "border-red-400 bg-red-50 text-red-700" : "border-gray-200"} ${nameLocked ? "bg-gray-100 text-gray-500" : ""} ${item.inventory_item_id ? "pr-12" : ""}`}
                      required disabled={nameLocked}
                      title={item.inventory_conflict ? t.quotation_item_conflict : (isReturned ? "Không thể sửa tên sản phẩm đã có trả hàng" : undefined)} />
                    {item.inventory_item_id ? (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-wide text-blue-500 bg-blue-50 px-1 rounded pointer-events-none">{t.form_stock_linked}</span>
                    ) : null}
                    {stockOpenRow === i && !nameLocked && (() => {
                      const query = item.name.toLowerCase();
                      const usedIds = new Set(items.filter((_, j) => j !== i).map((it) => it.inventory_item_id));
                      const matches = stock.filter((s) => !usedIds.has(s.id) && (s.name.toLowerCase().includes(query) || (s.serial_number || "").toLowerCase().includes(query))).slice(0, 8);
                      if (matches.length === 0) return null;
                      return (
                        <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-auto">
                          {matches.map((s) => (
                            <button key={s.id} type="button" onClick={() => pickStock(i, s)}
                              className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm flex justify-between items-center border-b border-gray-50 last:border-0">
                              <span className="font-medium text-gray-800">{s.name}</span>
                              <span className="text-gray-500 text-xs tabular-nums">{formatNumber(s.purchase_price)}</span>
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-2 py-2"><input data-col="serial" data-row={i} value={item.serial_number || ""} onChange={(e) => updateItem(i, "serial_number", e.target.value || null)} onKeyDown={(e) => handleTabDown(e, "serial", i)} className="border border-gray-200 rounded-lg px-2.5 py-1.5 w-full text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" /></td>
                  <td className="px-2 py-2"><select value={item.condition || "2nd"} onChange={(e) => updateItem(i, "condition", e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white"><option value="2nd">2nd</option><option value="new">New</option></select></td>
                  <td className="px-2 py-2"><input data-col="cost" data-row={i} type="text" inputMode="numeric" value={formatNumber(item.purchase_price)} onChange={(e) => updateItem(i, "purchase_price", parseNumber(e.target.value))} onKeyDown={(e) => handleTabDown(e, "cost", i)} className="border border-gray-200 rounded-lg px-2.5 py-1.5 w-full text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" /></td>
                  <td className="px-2 py-2"><input data-col="price" data-row={i} type="text" inputMode="numeric" value={formatNumber(item.selling_price)} onChange={(e) => updateItem(i, "selling_price", parseNumber(e.target.value))} onKeyDown={(e) => handleTabDown(e, "price", i)} className="border border-gray-200 rounded-lg px-2.5 py-1.5 w-full text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" /></td>
                  <td className="px-2 py-2">
                    <div className="flex gap-1">
                      <input
                        type="number" min={1} max={99}
                        value={item.warranty_count ?? ""}
                        onChange={(e) => updateItem(i, "warranty_count", e.target.value === "" ? null : Number(e.target.value))}
                        className="border border-gray-200 rounded-lg px-1.5 py-1.5 w-14 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                      />
                      <select
                        value={item.warranty_unit ?? ""}
                        onChange={(e) => updateItem(i, "warranty_unit", e.target.value === "" ? null : (e.target.value as WarrantyUnit))}
                        className="border border-gray-200 rounded-lg px-1.5 py-1.5 flex-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white"
                      >
                        <option value="">—</option>
                        <option value="month">{t.warranty_unit_month}</option>
                        <option value="week">{t.warranty_unit_week}</option>
                      </select>
                    </div>
                  </td>
                  <td className="px-2 py-2"><DateInput value={item.warranty_start || ""} onChange={(v) => updateItem(i, "warranty_start", v || null)} className="border border-gray-200 rounded-lg px-2 py-1.5 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" /></td>
                  <td className="px-2 py-2 text-center">
                    {(() => {
                      const active = isWarrantyActive(item.warranty_start, item.warranty_count, item.warranty_unit);
                      if (active === null) return <span className="text-gray-300 text-sm">—</span>;
                      return active ? (
                        <svg className="w-4 h-4 text-green-500 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      ) : (
                        <svg className="w-4 h-4 text-red-500 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                      );
                    })()}
                  </td>
                  <td className="px-2 py-2"><input value={item.notes || ""} onChange={(e) => updateItem(i, "notes", e.target.value)} className="border border-gray-200 rounded-lg px-2.5 py-1.5 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" /></td>
                  <td className="px-1 py-2 text-center">{!isReturned && !saleLocked && <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} className="p-1 rounded-md hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>}</td>
                </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50/50">
                <td colSpan={4} className="px-2 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">{t.form_total}</td>
                <td className="px-2 py-2.5 text-right text-sm font-semibold text-gray-800 tabular-nums pr-5">{formatNumber(items.reduce((s, i) => s + (i.purchase_price || 0), 0))}</td>
                <td className="px-2 py-2.5 text-right text-sm font-semibold text-gray-800 tabular-nums pr-5">{formatNumber(items.reduce((s, i) => s + (i.selling_price || 0), 0))}</td>
                <td></td>
                <td colSpan={4}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex justify-between items-center px-5 py-3 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">{t.form_trade_ins}</h3>
          <div className="flex items-center gap-4">
            {tradeIns.some((i) => i.name.trim() !== "") && (
              <button type="button" disabled={saving} onClick={() => doSubmit(true)}
                className="inline-flex items-center gap-1 text-emerald-600 text-sm font-medium hover:text-emerald-700 transition-colors disabled:opacity-50">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                {t.form_import_stock}
              </button>
            )}
            <button type="button" onClick={() => setTradeIns([...tradeIns, { ...EMPTY_TRADE_IN }])}
              className="inline-flex items-center gap-1 text-blue-600 text-sm font-medium hover:text-blue-700 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              {t.form_add_trade_in}
            </button>
          </div>
        </div>
        {tradeIns.length > 0 ? (
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="w-[6%] px-2 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{t.form_col_stt}</th>
                <th className="w-[32%] px-2 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.quotation_col_name}</th>
                <th className="w-[16%] px-2 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.form_col_serial}</th>
                <th className="w-[21%] px-2 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.form_trade_in_price}</th>
                <th className="w-[21%] px-2 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.form_trade_in_resale_price}</th>
                <th className="w-[4%]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tradeIns.map((item, i) => (
                <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-2 py-2 text-center text-xs text-gray-400 tabular-nums">{i + 1}</td>
                  <td className="px-2 py-2"><input data-col="name" data-row={i} value={item.name} onChange={(e) => updateTradeIn(i, "name", e.target.value)} onKeyDown={(e) => handleTabDown(e, "name", i)} className="border border-gray-200 rounded-lg px-2.5 py-1.5 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" /></td>
                  <td className="px-2 py-2"><input data-col="serial" data-row={i} value={item.serial_number || ""} onChange={(e) => updateTradeIn(i, "serial_number", e.target.value || null)} className="border border-gray-200 rounded-lg px-2.5 py-1.5 w-full text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" /></td>
                  <td className="px-2 py-2"><input data-col="purchase_price" data-row={i} type="text" inputMode="numeric" value={formatNumber(item.purchase_price)} onChange={(e) => updateTradeIn(i, "purchase_price", parseNumber(e.target.value))} onKeyDown={(e) => handleTabDown(e, "purchase_price", i)} className="border border-gray-200 rounded-lg px-2.5 py-1.5 w-full text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" /></td>
                  <td className="px-2 py-2"><input data-col="resale_price" data-row={i} type="text" inputMode="numeric" value={formatNumber(item.resale_price)} onChange={(e) => updateTradeIn(i, "resale_price", parseNumber(e.target.value))} onKeyDown={(e) => handleTabDown(e, "resale_price", i)} className="border border-gray-200 rounded-lg px-2.5 py-1.5 w-full text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" /></td>
                  <td className="px-1 py-2 text-center"><button type="button" onClick={() => setTradeIns(tradeIns.filter((_, j) => j !== i))} className="p-1 rounded-md hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-5 py-6 text-center text-gray-400 text-sm">{t.form_no_trade_ins}</div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">{t.quotation_note_label}</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors" />
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm">
          {saving ? t.saving : mode === "create" ? t.form_create : t.form_update}
        </button>
        <button type="button" onClick={() => router.back()}
          className="border border-gray-200 px-4 py-2.5 rounded-lg text-sm hover:bg-gray-50 transition-colors">{t.cancel}</button>
      </div>

      {showSyncWarning && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[10000]" onClick={() => setShowSyncWarning(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5 relative" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setShowSyncWarning(false)}
              className="absolute top-3 right-3 p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h2 className="text-base font-bold text-gray-800 mb-2">{t.form_tradein_sync_title}</h2>
            <p className="text-sm text-gray-700 mb-5">{t.form_tradein_sync_msg}</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => doSubmit(false)}
                className="border border-gray-300 px-4 py-1.5 rounded text-sm text-gray-700 hover:bg-gray-50">{t.form_tradein_save_only}</button>
              <button type="button" onClick={() => doSubmit(true)}
                className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700">{t.form_tradein_sync_save}</button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
