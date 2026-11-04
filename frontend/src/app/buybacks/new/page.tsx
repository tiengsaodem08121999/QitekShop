"use client";

import AppLayout from "@/components/layout/AppLayout";
import BuybackForm from "@/components/buyback/BuybackForm";
import { useT } from "@/lib/i18n";

export default function NewBuybackPage() {
  const t = useT();
  return (
    <AppLayout>
      <h1 className="text-xl font-bold mb-6">{t.buybacks_new}</h1>
      <BuybackForm />
    </AppLayout>
  );
}
