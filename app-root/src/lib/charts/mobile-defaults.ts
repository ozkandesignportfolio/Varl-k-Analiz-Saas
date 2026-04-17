/**
 * Shared Chart.js option fragments optimized for mobile readability and
 * rendering cost. Keep this file side-effect free — individual chart
 * components still register the scales/elements they need via
 * `@/components/kpi/chartjs-setup`.
 *
 * Design goals (see PRD #2 "Dashboard Chart Redesign — Mobile-first
 * Simplification"):
 *   - reduce visual clutter: thin grids, no borders, no legends when a
 *     single series is shown.
 *   - cap tick density so labels never overlap on <480px screens.
 *   - cap device-pixel ratio so high-DPI phones do not allocate huge
 *     canvas bitmaps (reduces GPU memory + scroll jank).
 *   - shorter animations so repaint during mount/update is cheap.
 */

import type { ChartOptions } from "chart.js";

// Cap the canvas DPR. At DPR 3 an iPhone Pro renders 9x the pixels of DPR 1
// which is noticeable on long charts. Two is visually indistinguishable for
// line/bar art.
const CHART_MAX_DEVICE_PIXEL_RATIO = 2;

// Short animation keeps initial paint fast without looking static.
const CHART_ANIMATION_DURATION_MS = 250;

const AXIS_TICK_COLOR = "#cbd5e1";
const AXIS_GRID_COLOR = "rgba(148, 163, 184, 0.08)";

/**
 * Base option fragment applied to all dashboard / cost / KPI charts. Merge
 * it first and override specifics in each component.
 */
export const mobileChartBase = {
  responsive: true,
  maintainAspectRatio: false,
  devicePixelRatio: CHART_MAX_DEVICE_PIXEL_RATIO,
  animation: {
    duration: CHART_ANIMATION_DURATION_MS,
  },
  interaction: {
    mode: "index" as const,
    intersect: false,
  },
} satisfies Partial<ChartOptions>;

/**
 * Tick preset used on category (x) axes. `maxTicksLimit: 5` keeps 12-month
 * labels legible on 360px screens.
 */
export const mobileCategoryAxisTicks = {
  color: AXIS_TICK_COLOR,
  autoSkip: true,
  maxTicksLimit: 5,
  maxRotation: 0,
  font: { size: 11 },
} as const;

/**
 * Tick preset used on linear (y) axes.
 */
export const mobileLinearAxisTicks = {
  color: AXIS_TICK_COLOR,
  maxTicksLimit: 4,
  font: { size: 11 },
} as const;

export const mobileAxisGrid = {
  color: AXIS_GRID_COLOR,
} as const;

export const mobileAxisNoGrid = {
  display: false,
} as const;

export const mobileAxisNoBorder = {
  display: false,
} as const;
