"use client";

import type { ChartData, ChartOptions } from "chart.js";
import { Chart } from "react-chartjs-2";
import "./chartjs-setup";
import {
  mobileAxisGrid,
  mobileAxisNoBorder,
  mobileAxisNoGrid,
  mobileCategoryAxisTicks,
  mobileChartBase,
  mobileLinearAxisTicks,
} from "@/lib/charts/mobile-defaults";

type AssetPerformancePoint = {
  assetName: string;
  score: number;
  serviceCount: number;
};

type AssetPerformanceComparisonChartProps = {
  points: AssetPerformancePoint[];
};

export function AssetPerformanceComparisonChart({
  points,
}: AssetPerformanceComparisonChartProps) {
  const data: ChartData<"bar" | "line"> = {
    labels: points.map((point) => point.assetName),
    datasets: [
      {
        type: "bar",
        label: "Performans skoru",
        data: points.map((point) => Number(point.score.toFixed(1))),
        yAxisID: "y",
        backgroundColor: "rgba(99, 102, 241, 0.65)",
        borderColor: "rgba(129, 140, 248, 1)",
        borderWidth: 1,
        borderRadius: 8,
      },
      {
        type: "line",
        label: "Servis adedi (12 ay)",
        data: points.map((point) => point.serviceCount),
        yAxisID: "y1",
        borderColor: "#f59e0b",
        backgroundColor: "#f59e0b",
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.25,
      },
    ],
  };

  const options: ChartOptions<"bar" | "line"> = {
    ...mobileChartBase,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: "#e2e8f0",
          boxWidth: 10,
          boxHeight: 10,
          padding: 12,
          font: { size: 11 },
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            if (context.dataset.yAxisID === "y1") {
              return `${context.dataset.label}: ${Number(context.parsed.y ?? 0)}`;
            }
            return `${context.dataset.label}: ${Number(context.parsed.y ?? 0).toFixed(1)}`;
          },
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
        max: 100,
        ticks: mobileLinearAxisTicks,
        grid: mobileAxisGrid,
        border: mobileAxisNoBorder,
      },
      y1: {
        beginAtZero: true,
        position: "right",
        ticks: {
          ...mobileLinearAxisTicks,
          color: "#fcd34d",
          precision: 0,
        },
        grid: { drawOnChartArea: false },
        border: mobileAxisNoBorder,
      },
    },
  };

  return <Chart type="bar" data={data} options={options} />;
}
