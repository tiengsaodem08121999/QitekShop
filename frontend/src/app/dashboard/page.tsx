"use client";

import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import RevenueProfitChart from "@/components/dashboard/RevenueProfitChart";
import { apiFetch } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { apiError } from "@/lib/apiError";
import { useToast } from "@/components/Toast";
import type { DashboardData } from "@/types";

export default function DashboardPage() {
  const t = useT();
  const toast = useToast();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    apiFetch<DashboardData>(`/api/dashboard?year=${year}`)
      .then(setData)
      .catch((err) => toast(apiError(err, t), "error"));
  }, [year, toast, t.error]);

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <AppLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">{t.dashboard_title}</h1>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          {t.dashboard_year_label}
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>
      {data && <RevenueProfitChart months={data.months} />}
    </AppLayout>
  );
}
