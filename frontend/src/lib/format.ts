export function formatNumber(v: string | number): string {
  const n = String(v).replace(/\D/g, "");
  return n.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function parseNumber(v: string): number {
  return Number(v.replace(/,/g, "")) || 0;
}

export function formatDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

import type { WarrantyUnit } from "@/types";

export function formatWarranty(
  count: number | null,
  unit: WarrantyUnit | null,
  t: { warranty_unit_month: string; warranty_unit_week: string },
  fallback = "—",
): string {
  if (count == null || unit == null) return fallback;
  const label = unit === "month" ? t.warranty_unit_month : t.warranty_unit_week;
  return `${count} ${label.toLowerCase()}`;
}
