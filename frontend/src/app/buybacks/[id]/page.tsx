"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import BuybackForm from "@/components/buyback/BuybackForm";
import { useToast } from "@/components/Toast";
import { apiFetch } from "@/lib/api";
import { apiError } from "@/lib/apiError";
import { useT } from "@/lib/i18n";
import type { Buyback } from "@/types";

export default function EditBuybackPage() {
  const { id } = useParams();
  const t = useT();
  const toast = useToast();
  const [buyback, setBuyback] = useState<Buyback | null>(null);

  useEffect(() => {
    apiFetch<Buyback>(`/api/buybacks/${id}`)
      .then(setBuyback)
      .catch((err) => toast(apiError(err, t), "error"));
  }, [id, toast, t.error]);

  if (!buyback) return <AppLayout><p>{t.loading}</p></AppLayout>;

  return (
    <AppLayout>
      <h1 className="text-xl font-bold mb-6">{buyback.title}</h1>
      <BuybackForm initial={buyback} />
    </AppLayout>
  );
}
