"use client";

import type { ChartData, ChartOptions } from "chart.js";
import { Line } from "react-chartjs-2";
import "@/components/kpi/chartjs-setup";
import type { CostPoint } from "@/lib/charts";
import {
  mobileAxisGrid,
  mobileAxisNoBorder,
  mobileAxisNoGrid,
  mobileCategoryAxisTicks,
  mobileChartBase,
  mobileLinearAxisTicks,
} from "@/lib/charts/mobile-defaults";

type CostTrendLineChartProps = {
  points: CostPoint[];
};

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const compactCurrencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function CostTrendLineChart({ points }: CostTrendLineChartProps) {
  const data: ChartData<"line"> = {
    labels: points.map((point) => point.label),
    datasets: [
      {
        label: "Aylık Maliyet",
        data: points.map((point) => point.total),
        borderColor: "#38bdf8",
        backgroundColor: "rgba(56, 189, 248, 0.16)",
        pointBorderColor: "#38bdf8",
        pointBackgroundColor: "#22d3ee",
        pointRadius: 2,
        pointHoverRadius: 5,
        tension: 0.25,
        fill: true,
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    ...mobileChartBase,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => currencyFormatter.format(Number(context.parsed.y ?? 0)),
        },
      },
    },
    scales: {
      x: {
        ticks: mobileCategoryAxisTicks,
        grid: mobileAxisNoGrid,
        border: mobileAxisNoBorder,
      },
      y: {
        beginAtZero: true,
        ticks: {
          ...mobileLinearAxisTicks,
          callback: (value) => compactCurrencyFormatter.format(Number(value)),
        },
        grid: mobileAxisGrid,
        border: mobileAxisNoBorder,
      },
    },
  };

  return <Line data={data} options={options} />;
}

