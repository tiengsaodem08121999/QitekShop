export const INVENTORY_ITEM_TYPES = [
  "Main",
  "CPU",
  "Ram",
  "SSD",
  "Vga",
  "PSU",
  "Case",
  "Tản",
  "Fan",
] as const;

export const INVENTORY_ITEM_TYPE_OTHER = "Khác" as const;

export const INVENTORY_ITEM_TYPE_OPTIONS = [
  ...INVENTORY_ITEM_TYPES,
  INVENTORY_ITEM_TYPE_OTHER,
] as const;

export type InventoryItemType = (typeof INVENTORY_ITEM_TYPES)[number];
export type InventoryItemTypeOption = (typeof INVENTORY_ITEM_TYPE_OPTIONS)[number];

/** Split stored name like "Main Z690 tuf" into type + remainder. */
export function splitInventoryItemName(fullName: string): {
  type: InventoryItemTypeOption;
  name: string;
} {
  for (const type of INVENTORY_ITEM_TYPES) {
    const prefix = `${type} `;
    if (fullName.startsWith(prefix)) {
      return { type, name: fullName.slice(prefix.length) };
    }
    if (fullName === type) {
      return { type, name: "" };
    }
  }
  // Legacy names saved as "Tan …"
  if (fullName.startsWith("Tan ")) {
    return { type: "Tản", name: fullName.slice(4) };
  }
  return { type: INVENTORY_ITEM_TYPE_OTHER, name: fullName };
}

export function buildInventoryItemName(type: string, name: string): string {
  const trimmed = name.trim();
  if (!type || type === INVENTORY_ITEM_TYPE_OTHER) return trimmed;
  if (!trimmed) return type;
  return `${type} ${trimmed}`;
}
