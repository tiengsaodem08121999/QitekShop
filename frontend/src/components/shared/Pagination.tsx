"use client";

import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  center?: ReactNode;
}

/**
 * First 3 pages, last 3 pages, and the current page with its neighbours, so the next and
 * previous pages stay one click away. A gap hiding a single page shows that page instead.
 */
function visiblePages(page: number, totalPages: number): (number | "gap")[] {
  const wanted = [1, 2, 3, page - 1, page, page + 1, totalPages - 2, totalPages - 1, totalPages];
  const sorted = [...new Set(wanted)].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const items: (number | "gap")[] = [];
  let previous = 0;
  for (const p of sorted) {
    if (p - previous === 2) items.push(p - 1);
    else if (p - previous > 2) items.push("gap");
    items.push(p);
    previous = p;
  }
  return items;
}

export default function Pagination({ page, pageSize, total, onPageChange, center }: PaginationProps) {
  const t = useT();
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1 && !center) return null; // hide when a single page and nothing extra to show

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const pages = visiblePages(page, totalPages);

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 border-t border-gray-50 shrink-0 text-sm">
      <span className="text-gray-500 tabular-nums">{from}–{to} / {total}</span>
      {center ?? null}
      {totalPages > 1 ? (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          title={t.pagination_prev}
          aria-label={t.pagination_prev}
          className="px-2.5 py-1.5 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >‹</button>
        {pages.map((p, i) => p === "gap" ? (
          <span key={`gap-${i}`} aria-hidden="true" className="min-w-[32px] px-2 py-1.5 text-center text-gray-400">…</span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            aria-current={p === page ? "page" : undefined}
            className={`min-w-[32px] px-2 py-1.5 rounded-md tabular-nums transition-colors ${
              p === page ? "bg-blue-600 text-white font-medium" : "text-gray-600 hover:bg-gray-100"
            }`}
          >{p}</button>
        ))}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          title={t.pagination_next}
          aria-label={t.pagination_next}
          className="px-2.5 py-1.5 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >›</button>
      </div>
      ) : (
        <span />
      )}
    </div>
  );
}
