"use client";

import { useMemo } from "react";
import type { ChartData, ChartOptions } from "chart.js";
import { Line } from "react-chartjs-2";
import "@/components/kpi/chartjs-setup";

type ScoreTrendPoint = {
  month: string;
  score: number;
};

export function ScoreTrendChart({ points }: { points: ScoreTrendPoint[] }) {
  const data = useMemo<ChartData<"line">>(
    () => ({
      labels: points.map((point) => point.month),
      datasets: [
        {
          label: "Skor",
          data: points.map((point) => point.score),
          borderColor: "#22d3ee",
          backgroundColor: "rgba(34, 211, 238, 0.16)",
          pointBackgroundColor: "#67e8f9",
          pointBorderColor: "#67e8f9",
          pointRadius: 3,
          pointHoverRadius: 5,
          fill: true,
          tension: 0.34,
        },
      ],
    }),
    [points],
  );

  const options = useMemo<ChartOptions<"line">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: "rgba(15, 23, 42, 0.92)",
          borderColor: "rgba(103, 232, 249, 0.35)",
          borderWidth: 1,
          displayColors: false,
          callbacks: {
            label: (context) => `Skor: ${Number(context.parsed.y ?? 0)}/100`,
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: "#94a3b8",
          },
          grid: {
            color: "rgba(148, 163, 184, 0.08)",
          },
        },
        y: {
          min: 70,
          max: 85,
          ticks: {
            stepSize: 5,
            color: "#94a3b8",
          },
          grid: {
            color: "rgba(148, 163, 184, 0.12)",
          },
        },
      },
    }),
    [],
  );

  return <Line className="!h-full !w-full" data={data} options={options} />;
}
