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
import type { DashboardMonth } from "@/types";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend, ChartDataLabels);

function formatShort(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

export default function RevenueProfitChart({ months }: { months: DashboardMonth[] }) {
  const t = useT();
  const revenue = months.map((m) => m.revenue);
  const profit = months.map((m) => m.profit);

  const data = {
    labels: [...t.dashboard_month_labels],
    datasets: [
      {
        label: t.dashboard_revenue,
        data: revenue,
        backgroundColor: "#3b82f6",
      },
      {
        label: t.dashboard_profit,
        data: profit,
        backgroundColor: "#f59e0b",
      },
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
        color: "#b45309",
        font: { weight: "bold", size: 11 },
        formatter: (value: number, ctx) => {
          if (ctx.datasetIndex !== 1) return ""; // profit dataset only
          const rev = revenue[ctx.dataIndex];
          if (!rev) return "";
          return `${Math.round((value / rev) * 100)}%`;
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const val = ctx.parsed.y ?? 0;
            if (ctx.datasetIndex === 1) {
              const rev = revenue[ctx.dataIndex];
              const pct = rev ? Math.round((val / rev) * 100) : 0;
              return `${t.dashboard_profit}: ${val.toLocaleString()} (${pct}% ${t.dashboard_revenue})`;
            }
            return `${ctx.dataset.label}: ${val.toLocaleString()}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => formatShort(Number(value)),
        },
      },
    },
  };

  return (
    <div className="h-[420px]">
      <Bar data={data} options={options} />
    </div>
  );
}
