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
