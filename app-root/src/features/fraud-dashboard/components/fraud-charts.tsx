"use client";

import { useMemo } from "react";
import type { ChartData, ChartOptions } from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import "@/components/kpi/chartjs-setup";
import { Card } from "@/components/ui/card";
import type { FraudStatsResponse } from "@/lib/fraud/types";

type FraudChartsProps = {
  charts: FraudStatsResponse["charts"];
};

const PIE_COLORS = ["#34D399", "#F97316"];
const AXIS_COLOR = "#94A3B8";
const GRID_COLOR = "rgba(148,163,184,0.08)";

const baseAxisTick = {
  color: AXIS_COLOR,
  font: { size: 12 },
};

export function FraudCharts({ charts }: FraudChartsProps) {
  const signupData = useMemo<ChartData<"line">>(
    () => ({
      labels: charts.signupVolume.map((p) => p.label),
      datasets: [
        {
          label: "Total",
          data: charts.signupVolume.map((p) => p.total),
          borderColor: "#38BDF8",
          backgroundColor: "rgba(56,189,248,0.25)",
          borderWidth: 2.4,
          fill: true,
          tension: 0.35,
          pointRadius: 0,
        },
        {
          label: "Blocked",
          data: charts.signupVolume.map((p) => p.blocked),
          borderColor: "#F97316",
          backgroundColor: "rgba(249,115,22,0.2)",
          borderWidth: 2,
          fill: true,
          tension: 0.35,
          pointRadius: 0,
        },
      ],
    }),
    [charts.signupVolume],
  );

  const riskData = useMemo<ChartData<"bar">>(
    () => ({
      labels: charts.riskDistribution.map((p) => p.label),
      datasets: [
        {
          label: "Attempts",
          data: charts.riskDistribution.map((p) => p.count),
          backgroundColor: "#A855F7",
          borderRadius: 12,
        },
      ],
    }),
    [charts.riskDistribution],
  );

  const blockedData = useMemo<ChartData<"doughnut">>(
    () => ({
      labels: charts.blockedVsSuccessful.map((p) => p.label),
      datasets: [
        {
          data: charts.blockedVsSuccessful.map((p) => p.value),
          backgroundColor: charts.blockedVsSuccessful.map(
            (_, i) => PIE_COLORS[i % PIE_COLORS.length],
          ),
          borderWidth: 0,
        },
      ],
    }),
    [charts.blockedVsSuccessful],
  );

  const lineOptions = useMemo<ChartOptions<"line">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: baseAxisTick,
          grid: { display: false },
          border: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: { ...baseAxisTick, precision: 0 },
          grid: { color: GRID_COLOR },
          border: { display: false },
        },
      },
    }),
    [],
  );

  const barOptions = useMemo<ChartOptions<"bar">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: baseAxisTick,
          grid: { display: false },
          border: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: { ...baseAxisTick, precision: 0 },
          grid: { color: GRID_COLOR },
          border: { display: false },
        },
      },
    }),
    [],
  );

  const doughnutOptions = useMemo<ChartOptions<"doughnut">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: "65%",
      plugins: { legend: { display: false } },
    }),
    [],
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <Card className="gap-4 border-white/10 bg-[#09111F]/90 p-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-50">Signup Volume</h2>
          <p className="mt-1 text-sm text-slate-400">Recent signup traffic with blocked and successful patterns over time.</p>
        </div>
        <div className="h-[320px]">
          <Line data={signupData} options={lineOptions} />
        </div>
      </Card>

      <div className="grid gap-4">
        <Card className="gap-4 border-white/10 bg-[#09111F]/90 p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-50">Risk Distribution</h2>
            <p className="mt-1 text-sm text-slate-400">How recent attempts spread across low to critical scores.</p>
          </div>
          <div className="h-[220px]">
            <Bar data={riskData} options={barOptions} />
          </div>
        </Card>

        <Card className="gap-4 border-white/10 bg-[#09111F]/90 p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-50">Blocked vs Successful</h2>
            <p className="mt-1 text-sm text-slate-400">Immediate health read of the signup funnel quality.</p>
          </div>
          <div className="h-[220px]">
            <Doughnut data={blockedData} options={doughnutOptions} />
          </div>
          <div className="flex flex-wrap gap-3">
            {charts.blockedVsSuccessful.map((entry, index) => (
              <div key={entry.label} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-300">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                <span>{entry.label}</span>
                <span className="font-semibold text-slate-100">{entry.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
