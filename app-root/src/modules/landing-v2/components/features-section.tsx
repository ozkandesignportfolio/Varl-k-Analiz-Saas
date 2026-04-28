"use client"

import type { ComponentType } from "react"
import { BarChart3, Bell, Clock, FileText, Lock, QrCode, Shield, Smartphone, Wrench, Zap } from "lucide-react"
import { useInView } from "@/modules/landing-v2/hooks/use-in-view"

type FeatureTone = "primary-accent" | "accent-chart3" | "chart3-chart4" | "chart4-primary"

const features: Array<{
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>
  title: string
  description: string
  tone: FeatureTone
}> = [
  {
    icon: Shield,
    title: "Get a clear picture of your SaaS landscape",
    description: "Track every SaaS tool your team uses — Slack, Notion, Figma, AWS — all in a single, organized view.",
    tone: "primary-accent",
  },
  {
    icon: Wrench,
    title: "Identify unused and duplicate tools",
    description: "Instantly spot tools nobody uses and subscriptions that overlap. Stop paying for what you don’t need.",
    tone: "accent-chart3",
  },
  {
    icon: FileText,
    title: "Know who's using what",
    description: "Know exactly which team members are assigned to every subscription. No more guessing.",
    tone: "chart3-chart4",
  },
  {
    icon: BarChart3,
    title: "Understand your software spending",
    description: "See your total monthly SaaS costs at a glance. Know where every dollar goes with clear charts and breakdowns.",
    tone: "chart4-primary",
  },
  {
    icon: Bell,
    title: "Stay on top of invoices and payments",
    description: "Track every invoice, expense and renewal date. Get alerts before charges hit so nothing slips through.",
    tone: "primary-accent",
  },
  {
    icon: Clock,
    title: "Track equipment costs and warranties",
    description: "Monitor hardware like laptops and routers alongside SaaS. Track warranties, service history and assigned users.",
    tone: "accent-chart3",
  },
  {
    icon: QrCode,
    title: "Find any subscription in seconds",
    description: "Filter by tool name, category or team member. Locate any subscription instantly with powerful search.",
    tone: "chart3-chart4",
  },
  {
    icon: Zap,
    title: "Automate alerts and cost reports",
    description: "Get renewal reminders, unused tool alerts and monthly PDF cost reports — all on autopilot.",
    tone: "chart4-primary",
  },
  {
    icon: Lock,
    title: "Enterprise-grade security",
    description: "Team data is fully isolated. Encrypted communication and private storage keep your information safe.",
    tone: "primary-accent",
  },
  {
    icon: Smartphone,
    title: "Access from any device",
    description: "In a meeting, on the road or at your desk — the same powerful experience on every device.",
    tone: "accent-chart3",
  },
]

export function FeaturesSection() {
  const { ref, inView } = useInView(0.1)

  return (
    <section id="ozellikler" className="relative isolate py-20 sm:py-28 lg:py-32" ref={ref}>
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-12 text-center sm:mb-20">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5">
            <span className="text-xs tracking-widest text-primary">WHAT YOU CAN DO</span>
          </div>
          <h2 className="text-balance text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl">
            One platform to <span className="text-gradient">control your SaaS costs</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            From subscription tracking to cost analysis — reduce SaaS waste and make smarter software decisions
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {features.map((feature, i) => (
            <div
              key={i}
              data-tone={feature.tone}
              className={`landing-v2-feature-card glass-card group cursor-default rounded-2xl p-6 transition-all duration-500 ${
                inView ? "animate-slide-up" : "opacity-0"
              }`}
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className="landing-v2-feature-icon mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-all group-hover:-translate-y-0.5 group-hover:scale-105">
                <feature.icon aria-hidden className="landing-v2-feature-icon-glyph h-5 w-5" />
              </div>
              <h3 className="mb-2 text-base font-semibold text-foreground">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
