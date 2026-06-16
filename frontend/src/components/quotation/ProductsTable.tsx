"use client";

import { formatDate, formatWarranty, isWarrantyActive } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { QuotationItem } from "@/types";

interface Props {
  products: QuotationItem[];
  returnedNames: Set<string>;
  customerName: string;
  showCost: boolean;
  onToggleShowCost: () => void;
  checkedItems: Set<number>;
  onCheckedItemsChange: (next: Set<number>) => void;
}

export default function ProductsTable({
  products,
  returnedNames,
  customerName,
  showCost,
  onToggleShowCost,
  checkedItems,
  onCheckedItemsChange,
}: Props) {
  const t = useT();

  function toggleOne(index: number, checked: boolean) {
    const next = new Set(checkedItems);
    if (checked) next.add(index); else next.delete(index);
    onCheckedItemsChange(next);
  }

  function toggleAll(checked: boolean) {
    if (checked) onCheckedItemsChange(new Set(products.map((_, i) => i)));
    else onCheckedItemsChange(new Set());
  }

  const checkedSellingTotal = products
    .filter((_, i) => checkedItems.has(i))
    .reduce((sum, item) => sum + item.selling_price, 0);
  const checkedPurchaseTotal = products
    .filter((_, i) => checkedItems.has(i))
    .reduce((sum, item) => sum + item.purchase_price, 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider hide-on-screenshot">{t.quotation_products}</h3>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider show-on-screenshot">{customerName}</h3>
      </div>
      <table className="w-full text-sm table-fixed">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="w-[4%] px-2 py-3 text-center hide-on-screenshot">
              <input
                type="checkbox"
                checked={products.length > 0 && checkedItems.size === products.length}
                onChange={(e) => toggleAll(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
            </th>
            <th className="w-[16%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.quotation_col_name}</th>
            <th className="w-[10%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.quotation_col_serial}</th>
            <th className="w-[6%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.quotation_col_cond}</th>
            <th className="w-[14%] px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider hide-on-screenshot">
              <button
                onClick={onToggleShowCost}
                className="inline-flex items-center gap-1 hover:text-gray-700 transition-colors"
                title={t.quotation_col_cost}
              >
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
            <th className="w-[5%] px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{t.quotation_col_warranty_status}</th>
            <th className="w-[9%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.quotation_col_notes}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {products.map((item, i) => {
            const isReturned = returnedNames.has(item.name);
            return (
              <tr key={i} className={`hover:bg-gray-50/50 transition-colors ${isReturned ? "line-through opacity-50" : ""}`}>
                <td className="px-2 py-3 text-center hide-on-screenshot">
                  <input
                    type="checkbox"
                    checked={checkedItems.has(i)}
                    onChange={(e) => toggleOne(i, e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </td>
                <td className="px-4 py-3 font-medium text-gray-800">{item.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{item.serial_number || t.dash}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                    item.condition === "new" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"
                  }`}>{item.condition}</span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-600 hide-on-screenshot">{showCost ? item.purchase_price.toLocaleString() : "•••"}</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-800">{item.selling_price.toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatWarranty(item.warranty_count, item.warranty_unit, t, t.dash)}</td>
                <td className="px-4 py-3 text-gray-500">{item.warranty_start ? formatDate(item.warranty_start) : t.dash}</td>
                <td className="px-4 py-3 text-center">
                  {(() => {
                    const active = isWarrantyActive(item.warranty_start, item.warranty_count, item.warranty_unit);
                    if (active === null) return <span className="text-gray-300">{t.dash}</span>;
                    return active ? (
                      <svg className="w-4 h-4 text-green-500 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    ) : (
                      <svg className="w-4 h-4 text-red-500 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                    );
                  })()}
                </td>
                <td className="px-4 py-3 text-gray-400">{item.notes || t.dash}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="hide-on-screenshot">
          <tr className="bg-gray-50/80 border-t border-gray-200">
            <td></td>
            <td className="px-4 py-3 font-semibold text-gray-700" colSpan={3}>{t.quotations_total}</td>
            <td className="px-4 py-3 text-right tabular-nums font-bold text-gray-600">
              {showCost ? checkedPurchaseTotal.toLocaleString() : "•••"}
            </td>
            <td className="px-4 py-3 text-right tabular-nums font-bold text-gray-800">
              {checkedSellingTotal.toLocaleString()}
            </td>
            <td colSpan={4}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
