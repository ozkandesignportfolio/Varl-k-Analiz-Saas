"use client";

import type { ChartData, ChartOptions } from "chart.js";
import { Bar } from "react-chartjs-2";
import "@/components/kpi/chartjs-setup";
import type { CostPoint } from "@/lib/charts";

type YearlyCostBarChartProps = {
  points: CostPoint[];
};

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function YearlyCostBarChart({ points }: YearlyCostBarChartProps) {
  const data: ChartData<"bar"> = {
    labels: points.map((point) => point.label),
    datasets: [
      {
        label: "Yıllık Toplam",
        data: points.map((point) => point.total),
        backgroundColor: "rgba(244, 114, 182, 0.55)",
        borderColor: "rgba(244, 114, 182, 1)",
        borderWidth: 1,
        borderRadius: 8,
      },
    ],
  };

  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context) => currencyFormatter.format(Number(context.parsed.y ?? 0)),
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: "#cbd5e1",
        },
        grid: {
          color: "rgba(148, 163, 184, 0.08)",
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: "#cbd5e1",
          callback: (value) => currencyFormatter.format(Number(value)),
        },
        grid: {
          color: "rgba(148, 163, 184, 0.12)",
        },
      },
    },
  };

  return <Bar data={data} options={options} />;
}

