"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import type { FraudStatsResponse } from "@/lib/fraud/types";

type FraudChartsProps = {
  charts: FraudStatsResponse["charts"];
};

const tooltipStyle = {
  background: "#020817",
  border: "1px solid rgba(148, 163, 184, 0.15)",
  borderRadius: "16px",
  color: "#E2E8F0",
};

const PIE_COLORS = ["#34D399", "#F97316"];

export function FraudCharts({ charts }: FraudChartsProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <Card className="gap-4 border-white/10 bg-[#09111F]/90 p-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-50">Signup Volume</h2>
          <p className="mt-1 text-sm text-slate-400">Recent signup traffic with blocked and successful patterns over time.</p>
        </div>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={charts.signupVolume}>
              <defs>
                <linearGradient id="signupTotalFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38BDF8" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#38BDF8" stopOpacity={0.03} />
                </linearGradient>
                <linearGradient id="signupBlockedFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F97316" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#F97316" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(148,163,184,0.08)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="total" stroke="#38BDF8" fill="url(#signupTotalFill)" strokeWidth={2.4} />
              <Area type="monotone" dataKey="blocked" stroke="#F97316" fill="url(#signupBlockedFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-4">
        <Card className="gap-4 border-white/10 bg-[#09111F]/90 p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-50">Risk Distribution</h2>
            <p className="mt-1 text-sm text-slate-400">How recent attempts spread across low to critical scores.</p>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.riskDistribution}>
                <CartesianGrid stroke="rgba(148,163,184,0.08)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" radius={[12, 12, 0, 0]} fill="#A855F7" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="gap-4 border-white/10 bg-[#09111F]/90 p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-50">Blocked vs Successful</h2>
            <p className="mt-1 text-sm text-slate-400">Immediate health read of the signup funnel quality.</p>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip contentStyle={tooltipStyle} />
                <Pie
                  data={charts.blockedVsSuccessful}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={52}
                  outerRadius={80}
                  paddingAngle={3}
                >
                  {charts.blockedVsSuccessful.map((entry, index) => (
                    <Cell key={entry.label} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
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
