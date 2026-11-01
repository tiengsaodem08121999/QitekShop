import type { QuotationItem, Return } from "@/types";

/**
 * Pair each return with the one sale line it refers to (several lines can share
 * a name, e.g. two identical RAM sticks). A return pinned to a stock item takes
 * the line linked to that item; the rest take the first free line with their name.
 * Returns a map of line index (into `products`) -> return id.
 */
export function matchReturnsToLines(products: QuotationItem[], returns: Return[]): Map<number, number> {
  const matched = new Map<number, number>();
  const pending: Return[] = [];
  for (const r of returns) {
    const idx = r.sold_inventory_item_id == null
      ? -1
      : products.findIndex((p, i) => !matched.has(i) && p.inventory_item_id === r.sold_inventory_item_id);
    if (idx >= 0) matched.set(idx, r.id);
    else pending.push(r);
  }
  for (const r of pending) {
    const idx = products.findIndex((p, i) => !matched.has(i) && p.name === r.item_name);
    if (idx >= 0) matched.set(idx, r.id);
  }
  return matched;
}
