"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import QuotationForm from "@/components/shared/QuotationForm";
import { useT } from "@/lib/i18n";
import type { Customer, QuotationItem } from "@/types";

export default function NewQuotationPage() {
  const t = useT();
  const searchParams = useSearchParams();
  const isCopy = searchParams.get("copy") === "1";
  const [copyData, setCopyData] = useState<{ customer: Customer; items: QuotationItem[] } | null>(null);
  const [ready, setReady] = useState(!isCopy);

  useEffect(() => {
    if (isCopy) {
      const raw = sessionStorage.getItem("quotation_copy");
      if (raw) {
        setCopyData(JSON.parse(raw));
        sessionStorage.removeItem("quotation_copy");
      }
      setReady(true);
    }
  }, [isCopy]);

  if (!ready) return <AppLayout><p>{t.loading}</p></AppLayout>;

  return (
    <AppLayout>
      <h1 className="text-xl font-bold mb-6">{t.quotation_new_title}</h1>
      <QuotationForm
        mode="create"
        initialCustomer={copyData?.customer}
        initialItems={copyData?.items}
      />
    </AppLayout>
  );
}
