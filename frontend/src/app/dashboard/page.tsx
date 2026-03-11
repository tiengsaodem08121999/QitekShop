"use client";

import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/api";
import type { DashboardData } from "@/types";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    apiFetch<DashboardData>("/api/dashboard").then(setData);
  }, []);

  return (
    <AppLayout>
      <h1 className="text-xl font-bold mb-6">Dashboard</h1>
      {data && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-5">
            <div className="text-gray-500 text-sm">Bao gia thang nay</div>
            <div className="text-2xl font-bold text-blue-700 mt-1">{data.quotation_count}</div>
          </div>
          <div className="bg-green-50 rounded-lg p-5">
            <div className="text-gray-500 text-sm">Tong thu thang</div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              {data.total_income.toLocaleString()}
            </div>
          </div>
          <div className="bg-red-50 rounded-lg p-5">
            <div className="text-gray-500 text-sm">Tong chi thang</div>
            <div className="text-2xl font-bold text-red-600 mt-1">
              {data.total_expense.toLocaleString()}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
