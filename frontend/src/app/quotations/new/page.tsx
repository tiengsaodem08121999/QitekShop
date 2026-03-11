"use client";

import AppLayout from "@/components/layout/AppLayout";
import QuotationForm from "@/components/shared/QuotationForm";

export default function NewQuotationPage() {
  return (
    <AppLayout>
      <h1 className="text-xl font-bold mb-6">Tạo báo giá mới</h1>
      <QuotationForm mode="create" />
    </AppLayout>
  );
}
