"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import QuotationForm from "@/components/shared/QuotationForm";
import { apiFetch } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { Quotation } from "@/types";

export default function EditQuotationPage() {
  const { id } = useParams();
  const t = useT();
  const [q, setQ] = useState<Quotation | null>(null);

  useEffect(() => {
    apiFetch<Quotation>(`/api/quotations/${id}`).then(setQ);
  }, [id]);

  if (!q) return <AppLayout><p>{t.loading}</p></AppLayout>;

  return (
    <AppLayout>
      <h1 className="text-xl font-bold mb-6">{t.quotation_edit_title(q.customer.name)}</h1>
      <QuotationForm
        mode="edit"
        quotationId={q.id}
        initialCustomer={q.customer}
        initialItems={q.items}
        initialPaid={q.total_paid}
      />
    </AppLayout>
  );
}
