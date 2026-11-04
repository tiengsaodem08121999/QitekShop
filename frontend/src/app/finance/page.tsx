"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import CashflowTab from "@/components/finance/CashflowTab";
import SalesTab from "@/components/finance/SalesTab";
import TransactionModal from "@/components/shared/TransactionModal";
import { useT } from "@/lib/i18n";
import type { Transaction } from "@/types";

function FinanceContent() {
  const router = useRouter();
  const t = useT();
  const isSales = useSearchParams().get("tab") === "sales";
  const [showModal, setShowModal] = useState(false);

  const tabs = [
    { key: "cashflow", href: "/finance", label: t.finance_tab_cashflow, active: !isSales },
    { key: "sales", href: "/finance?tab=sales", label: t.finance_tab_sales, active: isSales },
  ];

  return (
    <AppLayout>
      <div className="flex flex-col h-full overflow-hidden">
      <div className="flex justify-between items-end border-b border-gray-200 mb-4 shrink-0">
        <div role="tablist" className="flex gap-1">
          {tabs.map((tab) => (
            <button key={tab.key} role="tab" aria-selected={tab.active} onClick={() => router.replace(tab.href)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab.active ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
              {tab.label}
            </button>
          ))}
        </div>
        {!isSales && (
          <button onClick={() => setShowModal(true)}
            className="bg-blue-600 text-white px-4 py-2 mb-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
            {t.finance_add_txn}
          </button>
        )}
      </div>

      {isSales ? <SalesTab /> : <CashflowTab />}
      </div>
      {showModal && (
        <TransactionModal onClose={() => setShowModal(false)}
          onSaved={(txn: Transaction) => { setShowModal(false); const d = new Date(txn.date); router.push(`/finance/${d.getFullYear()}/${d.getMonth() + 1}`); }} />
      )}
    </AppLayout>
  );
}

export default function FinancePage() {
  const t = useT();
  return (
    <Suspense fallback={<AppLayout><p>{t.loading}</p></AppLayout>}>
      <FinanceContent />
    </Suspense>
  );
}
