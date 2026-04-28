"use client"

import { useInView } from "@/modules/landing-v2/hooks/use-in-view"
import { Bell, BellRing, Mail, Smartphone, Calendar, AlertTriangle, CheckCircle } from "lucide-react"

const notifications = [
  {
    icon: AlertTriangle,
    iconColor: "text-chart-4",
    iconBg: "bg-chart-4/10",
    title: "Unused Tool Detected",
    desc: "Analytics Tool — 0 active users in the last 30 days",
    time: "2 minutes ago",
    unread: true,
  },
  {
    icon: Calendar,
    iconColor: "text-accent",
    iconBg: "bg-accent/10",
    title: "Subscription Renewing",
    desc: "Design Platform Professional — Renews in 3 days",
    time: "1 hour ago",
    unread: true,
  },
  {
    icon: Mail,
    iconColor: "text-chart-3",
    iconBg: "bg-chart-3/10",
    title: "Invoice Reminder",
    desc: "Cloud Hosting — Monthly invoice due tomorrow",
    time: "3 hours ago",
    unread: false,
  },
  {
    icon: CheckCircle,
    iconColor: "text-primary",
    iconBg: "bg-primary/10",
    title: "License Cancellation Recorded",
    desc: "Video Tool — 2 user licenses successfully cancelled",
    time: "Yesterday",
    unread: false,
  },
]

export function BildirimSection() {
  const { ref, inView } = useInView()

  return (
    <section id="bildirimler" className="relative isolate py-20 sm:py-28 lg:py-32" ref={ref}>
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="pointer-events-none absolute top-1/3 right-0 z-0 hidden h-80 w-80 rounded-full bg-chart-4/5 blur-[120px] sm:block" />

      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-16">
          {/* Left - Content */}
          <div className={inView ? "animate-slide-in-left" : "opacity-0"}>
            <div className="inline-flex items-center gap-2 rounded-full border border-chart-4/20 bg-chart-4/5 px-4 py-1.5 mb-6">
              <Bell className="h-3.5 w-3.5 text-chart-4" />
              <span className="text-xs tracking-widest text-chart-4">Notifications</span>
            </div>
            <h2 className="text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl text-balance">
              Stop surprise{" "}
              <span className="text-gradient">charges</span>
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              Get notified before subscription renewals, when unused tools are detected and before invoices are charged — via email, push notifications and in-app alerts.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {[
                { icon: BellRing, label: "Renewal Alert", desc: "Get notified before subscriptions renew" },
                { icon: Mail, label: "Usage Report", desc: "Weekly SaaS usage summary" },
                { icon: Smartphone, label: "In-App Alerts", desc: "Instant cost change notifications" },
                { icon: Calendar, label: "Scheduled", desc: "7 and 30 days in advance" },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl border border-border/50 bg-secondary/30 p-4 transition-all hover:border-primary/20 hover:bg-secondary/50">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{item.label}</div>
                    <div className="text-xs text-muted-foreground">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right - Notification Demo */}
          <div className={`${inView ? "animate-slide-up" : "opacity-0"}`} style={{ animationDelay: "0.2s" }}>
            <div className="glass-card rounded-3xl p-6 animate-pulse-glow">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <BellRing className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">Notification Center</div>
                    <div className="text-xs text-muted-foreground">4 new notifications</div>
                  </div>
                </div>
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                  4
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {notifications.map((notif, i) => (
                  <div
                    key={i}
                    className={`group flex items-start gap-3 rounded-xl p-4 transition-all duration-300 hover:scale-[1.02] ${
                      notif.unread ? "bg-secondary/60 border border-primary/10" : "bg-secondary/30 border border-transparent"
                    }`}
                    style={{ animationDelay: `${i * 0.1 + 0.4}s` }}
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${notif.iconBg}`}>
                      <notif.icon className={`h-4.5 w-4.5 ${notif.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-foreground truncate">{notif.title}</div>
                        {notif.unread && <div className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{notif.desc}</div>
                      <div className="text-[10px] text-muted-foreground/60 mt-1">{notif.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
