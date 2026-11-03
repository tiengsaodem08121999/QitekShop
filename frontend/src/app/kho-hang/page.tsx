"use client";

// Public stock list: no login, no AppLayout. Shows only name + expected price.
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { useLocale } from "@/components/I18nProvider";
import Pagination from "@/components/shared/Pagination";

const PAGE_SIZE = 12;

interface PublicStockItem {
  name: string;
  note: string | null;
  expected_price: number | null;
}

export default function PublicStockPage() {
  const t = useT();
  const { locale, toggle } = useLocale();
  const [items, setItems] = useState<PublicStockItem[] | null>(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    // Plain fetch, not apiFetch: apiFetch redirects to /login on 401.
    fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/public/stock`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: { items: PublicStockItem[] }) => setItems(data.items))
      .catch(() => setError(true));
  }, []);

  const q = search.trim().toLowerCase();
  const shown = (items ?? []).filter((i) => !q || i.name.toLowerCase().includes(q));
  const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = shown.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">QitekComputer</h1>
            <p className="text-sm text-gray-500 mt-0.5">{t.public_stock_title}</p>
          </div>
          <button onClick={toggle} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-100">
            {locale === "en" ? "VN" : "EN"}
          </button>
        </div>

        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder={t.public_stock_search}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 mb-4 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
        />

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-5 py-3 font-medium">{t.inventory_col_name}</th>
                <th className="px-5 py-3 font-medium">{t.public_stock_col_note}</th>
                <th className="px-5 py-3 font-medium text-right">{t.public_stock_col_price}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {error && (
                <tr><td colSpan={3} className="px-5 py-12 text-center text-red-500">{t.public_stock_error}</td></tr>
              )}
              {!error && items === null && (
                <tr><td colSpan={3} className="px-5 py-12 text-center text-gray-400">{t.loading}</td></tr>
              )}
              {!error && items !== null && shown.length === 0 && (
                <tr><td colSpan={3} className="px-5 py-12 text-center text-gray-400">{t.public_stock_empty}</td></tr>
              )}
              {pageItems.map((it, i) => (
                <tr key={i}>
                  <td className="px-5 py-3 text-gray-800">{it.name}</td>
                  <td className="px-5 py-3 text-gray-500 whitespace-pre-line">{it.note || ""}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-medium text-gray-800 whitespace-nowrap">
                    {it.expected_price ? it.expected_price.toLocaleString() : <span className="text-gray-400 font-normal">{t.public_stock_contact}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={safePage} pageSize={PAGE_SIZE} total={shown.length} onPageChange={setPage} />
        </div>
        {/* Pagination shows "from–to / total" itself; with one page it is hidden. */}
        {items !== null && !error && totalPages === 1 && (
          <p className="text-xs text-gray-400 mt-3">{t.public_stock_count(shown.length)}</p>
        )}
      </div>
    </div>
  );
}
