"use client";

import { useT } from "@/lib/i18n";
import type { QuotationStatus } from "@/types";

const STYLE: Record<QuotationStatus, string> = {
  draft: "bg-amber-50 text-amber-700",
  confirmed: "bg-blue-50 text-blue-700",
  delivered: "bg-emerald-50 text-emerald-700",
};

export default function QuotationStatusBadge({ status }: { status: QuotationStatus }) {
  const t = useT();
  const label =
    status === "delivered" ? t.status_delivered
    : status === "confirmed" ? t.status_confirmed
    : t.status_draft;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${STYLE[status]}`}>
      {label}
    </span>
  );
}
