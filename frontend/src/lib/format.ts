export function formatNumber(v: string | number): string {
  const n = String(v).replace(/\D/g, "");
  return n.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function parseNumber(v: string): number {
  return Number(v.replace(/,/g, "")) || 0;
}
