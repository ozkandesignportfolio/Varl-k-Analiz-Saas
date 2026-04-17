"use client";

import type { ChartData, ChartOptions } from "chart.js";
import { Chart } from "react-chartjs-2";
import "./chartjs-setup";

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
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      legend: {
        labels: {
          color: "#e2e8f0",
          boxWidth: 14,
          boxHeight: 14,
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
        max: 100,
        ticks: {
          color: "#cbd5e1",
          maxTicksLimit: 4,
          font: { size: 11 },
        },
        grid: {
          color: "rgba(148, 163, 184, 0.08)",
        },
        border: { display: false },
      },
      y1: {
        beginAtZero: true,
        position: "right",
        ticks: {
          color: "#fcd34d",
          precision: 0,
          maxTicksLimit: 4,
          font: { size: 11 },
        },
        grid: {
          drawOnChartArea: false,
        },
        border: { display: false },
      },
    },
  };

  return <Chart type="bar" data={data} options={options} />;
}
