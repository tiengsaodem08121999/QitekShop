"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import QuotationForm from "@/components/shared/QuotationForm";
import { apiFetch } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { apiError } from "@/lib/apiError";
import { matchReturnsToLines } from "@/lib/returns";
import { useToast } from "@/components/Toast";
import type { Quotation } from "@/types";

function returnedItemIds(q: Quotation): Set<number> {
  const products = q.items.filter((i) => !i.is_trade_in);
  const ids = new Set<number>();
  for (const idx of matchReturnsToLines(products, q.returns).keys()) {
    const id = products[idx].id;
    if (id != null) ids.add(id);
  }
  return ids;
}

export default function EditQuotationPage() {
  const { id } = useParams();
  const t = useT();
  const toast = useToast();
  const [q, setQ] = useState<Quotation | null>(null);

  useEffect(() => {
    apiFetch<Quotation>(`/api/quotations/${id}`)
      .then(setQ)
      .catch((err) => toast(apiError(err, t), "error"));
  }, [id, toast, t.error]);

  if (!q) return <AppLayout><p>{t.loading}</p></AppLayout>;

  return (
    <AppLayout>
      <h1 className="text-xl font-bold mb-6">{t.quotation_edit_title(q.customer.name)}</h1>
      <QuotationForm
        mode="edit"
        quotationId={q.id}
        initialCustomer={q.customer}
        initialItems={q.items}
        initialNote={q.note}
        returnedItemIds={returnedItemIds(q)}
        status={q.status}
      />
    </AppLayout>
  );
}
