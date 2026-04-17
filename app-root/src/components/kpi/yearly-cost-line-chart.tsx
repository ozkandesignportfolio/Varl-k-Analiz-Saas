"use client";

import type { ChartData, ChartOptions } from "chart.js";
import { Line } from "react-chartjs-2";
import "./chartjs-setup";

type YearlyCostPoint = {
  label: string;
  total: number;
};

type YearlyCostLineChartProps = {
  points: YearlyCostPoint[];
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

export function YearlyCostLineChart({ points }: YearlyCostLineChartProps) {
  const data: ChartData<"line"> = {
    labels: points.map((point) => point.label),
    datasets: [
      {
        label: "Maliyet",
        data: points.map((point) => point.total),
        borderColor: "#38bdf8",
        backgroundColor: "rgba(56, 189, 248, 0.16)",
        pointBorderColor: "#38bdf8",
        pointBackgroundColor: "#ec4899",
        pointRadius: 2,
        pointHoverRadius: 5,
        fill: true,
        tension: 0.25,
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false,
    },
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
        ticks: {
          color: "#cbd5e1",
          autoSkip: true,
          maxTicksLimit: 6,
          maxRotation: 0,
          font: { size: 11 },
        },
        grid: { display: false },
        border: { display: false },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: "#cbd5e1",
          maxTicksLimit: 4,
          font: { size: 11 },
          callback: (value) => compactCurrencyFormatter.format(Number(value)),
        },
        grid: {
          color: "rgba(148, 163, 184, 0.08)",
        },
        border: { display: false },
      },
    },
  };

  return <Line data={data} options={options} />;
}

