"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  type ChartOptions,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { Bar } from "react-chartjs-2";
import { useT } from "@/lib/i18n";
import type { SalesProfitMonth } from "@/types";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend, ChartDataLabels);

function formatShort(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

/** Per month: total selling price, total purchase price, and the profit between them. */
export default function SalesProfitChart({ months }: { months: SalesProfitMonth[] }) {
  const t = useT();
  const totalRevenue = months.reduce((s, m) => s + m.revenue, 0);
  const totalProfit = months.reduce((s, m) => s + m.profit, 0);
  const totalPct = totalRevenue ? Math.round((totalProfit / totalRevenue) * 100) : 0;

  const data = {
    labels: [...t.dashboard_month_labels],
    datasets: [
      { label: t.dashboard_sales_selling, data: months.map((m) => m.revenue), backgroundColor: "#93c5fd" },
      { label: t.dashboard_sales_cost, data: months.map((m) => m.cost), backgroundColor: "#d1d5db" },
      { label: t.dashboard_profit, data: months.map((m) => m.profit), backgroundColor: "#10b981" },
    ],
  };

  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" },
      datalabels: {
        anchor: "end",
        align: "end",
        color: "#047857",
        font: { weight: "bold", size: 11 },
        formatter: (value: number, ctx) => (ctx.datasetIndex === 2 && value ? formatShort(value) : ""),
      },
      tooltip: {
        mode: "index",
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${(ctx.parsed.y ?? 0).toLocaleString()}`,
          footer: (items) => {
            const m = months[items[0].dataIndex];
            if (!m.revenue) return [];
            return [
              `${t.dashboard_sales_margin}: ${Math.round((m.profit / m.revenue) * 100)}%`,
              `${t.dashboard_sales_profit_quotation}: ${m.quotation_profit.toLocaleString()}`,
              `${t.dashboard_sales_profit_direct}: ${m.direct_profit.toLocaleString()}`,
            ];
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grace: "5%",
        ticks: {
          callback: (value) => formatShort(Number(value)),
        },
      },
    },
  };

  return (
    <>
      <p className="text-sm text-gray-500 mb-2">
        {t.dashboard_sales_year_total(totalProfit.toLocaleString(), totalRevenue.toLocaleString(), totalPct)}
      </p>
      <div className="h-[420px]">
        <Bar data={data} options={options} />
      </div>
    </>
  );
}
