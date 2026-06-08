"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import QuotationForm from "@/components/shared/QuotationForm";
import { apiFetch } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { apiError } from "@/lib/apiError";
import { useToast } from "@/components/Toast";
import type { Quotation } from "@/types";

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
        returnedNames={new Set(q.returns.map((r) => r.item_name))}
        status={q.status}
      />
    </AppLayout>
  );
}
