"use client";

import AppLayout from "@/components/layout/AppLayout";
import QuotationForm from "@/components/shared/QuotationForm";
import { useT } from "@/lib/i18n";

export default function NewQuotationPage() {
  const t = useT();
  return (
    <AppLayout>
      <h1 className="text-xl font-bold mb-6">{t.quotation_new_title}</h1>
      <QuotationForm mode="create" />
    </AppLayout>
  );
}
