"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react"
import { ChevronDown, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NAV_GROUPS, LANDING_NAV_SECTIONS, isLandingSectionHash } from "@/modules/landing-v2/components/section-nav"
import { Runtime } from "@/lib/env/runtime"

const HEADER_OFFSET = 80
const DEFAULT_SECTION = LANDING_NAV_SECTIONS[0]?.href ?? "#ozellikler"

const getFocusableElements = (container: HTMLElement) =>
  Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  )

const canUseSmoothScroll = () =>
  typeof document !== "undefined" && "scrollBehavior" in document.documentElement.style

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeHref, setActiveHref] = useState<string>(DEFAULT_SECTION)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [mobileAccordion, setMobileAccordion] = useState<string | null>("Ürün")
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  const mobileToggleRef = useRef<HTMLButtonElement>(null)
  const dropdownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Scroll detection ──
  useEffect(() => {
    let frame: number | null = null
    const updateScrolled = () => {
      const nextScrolled = window.scrollY > 20
      setScrolled((prev) => (prev === nextScrolled ? prev : nextScrolled))
      frame = null
    }
    const handleScroll = () => {
      if (frame !== null) return
      frame = window.requestAnimationFrame(updateScrolled)
    }
    handleScroll()
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame)
      window.removeEventListener("scroll", handleScroll)
    }
  }, [])

  // ── IntersectionObserver for active section ──
  useEffect(() => {
    const sections = LANDING_NAV_SECTIONS.map((link) => document.getElementById(link.href.slice(1))).filter(
      (section): section is HTMLElement => Boolean(section),
    )
    if (sections.length === 0) return

    const lastHref = LANDING_NAV_SECTIONS[LANDING_NAV_SECTIONS.length - 1]?.href ?? DEFAULT_SECTION
    const observer =
      Runtime.isClient() && window.IntersectionObserver
        ? new window.IntersectionObserver(
            (entries) => {
              const visibleEntries = entries
                .filter((entry) => entry.isIntersecting)
                .sort((left, right) => {
                  if (right.intersectionRatio !== left.intersectionRatio) {
                    return right.intersectionRatio - left.intersectionRatio
                  }
                  return left.boundingClientRect.top - right.boundingClientRect.top
                })
              const nextHref = visibleEntries[0]?.target.id ? `#${visibleEntries[0].target.id}` : null
              if (!nextHref) return
              setActiveHref((prev) => (prev === nextHref ? prev : nextHref))
            },
            { rootMargin: "-128px 0px -45% 0px", threshold: [0.12, 0.3, 0.55, 0.8] },
          )
        : null

    sections.forEach((section) => observer?.observe(section))

    const syncBottomSection = () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
        setActiveHref((prev) => (prev === lastHref ? prev : lastHref))
      }
    }
    syncBottomSection()
    window.addEventListener("scroll", syncBottomSection, { passive: true })
    return () => {
      observer?.disconnect()
      window.removeEventListener("scroll", syncBottomSection)
    }
  }, [])

  // ── Hash sync ──
  useEffect(() => {
    const syncHash = () => {
      const hash = window.location.hash
      if (isLandingSectionHash(hash)) setActiveHref(hash)
    }
    syncHash()
    window.addEventListener("hashchange", syncHash)
    return () => window.removeEventListener("hashchange", syncHash)
  }, [])

  // ── Mobile menu focus trap + body lock ──
  useEffect(() => {
    if (!mobileOpen) return
    const menuElement = mobileMenuRef.current
    if (!menuElement) return

    const focusable = getFocusableElements(menuElement)
    focusable[0]?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        setMobileOpen(false)
        mobileToggleRef.current?.focus()
        return
      }
      if (event.key !== "Tab") return
      const focusableElements = getFocusableElements(menuElement)
      if (focusableElements.length === 0) { event.preventDefault(); return }
      const first = focusableElements[0]
      const last = focusableElements[focusableElements.length - 1]
      const activeElement = document.activeElement as HTMLElement | null
      if (event.shiftKey) {
        if (!activeElement || activeElement === first) { event.preventDefault(); last.focus() }
        return
      }
      if (activeElement === last) { event.preventDefault(); first.focus() }
    }

    document.addEventListener("keydown", handleKeydown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", handleKeydown)
    }
  }, [mobileOpen])

  // ── Close desktop dropdown on outside click ──
  useEffect(() => {
    if (!openDropdown) return
    const handler = () => setOpenDropdown(null)
    document.addEventListener("click", handler)
    return () => document.removeEventListener("click", handler)
  }, [openDropdown])

  // ── Smooth scroll with header offset ──
  const scrollToSection = useCallback((href: string) => {
    const section = document.getElementById(href.slice(1))
    if (!section) return
    const y = section.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET
    try {
      if (canUseSmoothScroll()) {
        window.scrollTo({ top: y, behavior: "smooth" })
      } else {
        window.scrollTo(0, y)
      }
    } catch {
      window.scrollTo(0, y)
    }
    if (Runtime.isClient() && window.history?.replaceState) {
      window.history.replaceState(null, "", href)
    }
    setActiveHref(href)
  }, [])

  // ── Hybrid link handler: # → scroll, else → Next.js router ──
  const handleLinkClick = useCallback((href: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (href.startsWith("#")) {
      event.preventDefault()
      scrollToSection(href)
    }
    setMobileOpen(false)
    setOpenDropdown(null)
  }, [scrollToSection])

  const handleDropdownEnter = useCallback((label: string) => {
    if (dropdownTimeoutRef.current) clearTimeout(dropdownTimeoutRef.current)
    setOpenDropdown(label)
  }, [])

  const handleDropdownLeave = useCallback(() => {
    dropdownTimeoutRef.current = setTimeout(() => setOpenDropdown(null), 150)
  }, [])

  const isLinkActive = (href: string) => href.startsWith("#") && activeHref === href

  return (
    <nav
      className={`landing-v2-nav fixed top-0 left-0 right-0 z-[60] transition-all duration-500 ${
        scrolled ? "glass-card py-3 shadow-lg shadow-[#050a18]/50" : "bg-transparent py-5"
      }`}
      style={{ paddingTop: `max(env(safe-area-inset-top, 0px), ${scrolled ? '0.75rem' : '1.25rem'})` }}
    >
      <div className="relative z-[60] mx-auto flex max-w-7xl items-center justify-between px-6">
        {/* ── Logo ── */}
        <Link href="/" className="group flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 transition-all group-hover:border-primary/40 group-hover:bg-primary/20">
            <img src="/assetly-mark.svg" alt="" aria-hidden="true" className="h-6 w-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-foreground">ASSETLY</span>
            <span className="text-[10px] tracking-[0.2em] text-muted-foreground">Premium Kontrol Paneli</span>
          </div>
        </Link>

        {/* ── Desktop dropdown nav ── */}
        <div className="hidden items-center gap-1 lg:flex">
          {NAV_GROUPS.map((group) => (
            <div
              key={group.label}
              className="relative"
              onMouseEnter={() => handleDropdownEnter(group.label)}
              onMouseLeave={handleDropdownLeave}
            >
              <button
                type="button"
                className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm transition-all ${
                  openDropdown === group.label ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={(e) => {
                  e.stopPropagation()
                  setOpenDropdown(openDropdown === group.label ? null : group.label)
                }}
              >
                {group.label}
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${
                    openDropdown === group.label ? "rotate-180" : ""
                  }`}
                />
              </button>

              {openDropdown === group.label && (
                <div
                  className="absolute left-0 top-full z-50 min-w-[220px] pt-2"
                  onMouseEnter={() => handleDropdownEnter(group.label)}
                  onMouseLeave={handleDropdownLeave}
                >
                  <div className="glass-card rounded-xl border border-border/50 p-1.5 shadow-xl shadow-[#050a18]/60">
                    {group.links.map((link) => {
                      const active = isLinkActive(link.href)
                      const isHash = link.href.startsWith("#")

                      if (isHash) {
                        return (
                          <a
                            key={link.href}
                            href={link.href}
                            onClick={handleLinkClick(link.href)}
                            className={`block rounded-lg px-3 py-2 text-sm transition-all ${
                              active
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                            }`}
                          >
                            {link.label}
                          </a>
                        )
                      }

                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setOpenDropdown(null)}
                          className="block rounded-lg px-3 py-2 text-sm text-muted-foreground transition-all hover:bg-secondary/50 hover:text-foreground"
                        >
                          {link.label}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Auth buttons ── */}
        <div className="hidden items-center gap-3 lg:flex">
          <Button
            asChild
            variant="ghost"
            className="text-muted-foreground hover:bg-secondary/50 hover:text-foreground focus-visible:ring-primary/60"
          >
            <Link href="/login">Giriş Yap</Link>
          </Button>
          <Button
            asChild
            className="bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 focus-visible:ring-primary/70"
          >
            <Link href="/register">Kayıt Ol</Link>
          </Button>
        </div>

        {/* ── Mobile toggle ── */}
        <button
          ref={mobileToggleRef}
          onClick={() => setMobileOpen((prev) => !prev)}
          className="rounded-lg p-2 text-muted-foreground hover:text-foreground lg:hidden"
          aria-label="Menüyü aç/kapat"
          aria-expanded={mobileOpen}
          aria-controls="landing-v2-mobile-menu"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* ── Mobile menu ── */}
      {mobileOpen && (
        <div
          ref={mobileMenuRef}
          id="landing-v2-mobile-menu"
          className="glass-card mt-2 mx-4 max-h-[80vh] overflow-y-auto rounded-2xl p-4 lg:hidden animate-slide-up"
        >
          <div className="flex flex-col gap-1">
            {NAV_GROUPS.map((group) => (
              <div key={group.label}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary/30"
                  onClick={() => setMobileAccordion(mobileAccordion === group.label ? null : group.label)}
                >
                  {group.label}
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                      mobileAccordion === group.label ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {mobileAccordion === group.label && (
                  <div className="ml-3 flex flex-col gap-0.5 border-l border-border/30 pl-3 pb-2">
                    {group.links.map((link) => {
                      const active = isLinkActive(link.href)
                      const isHash = link.href.startsWith("#")

                      if (isHash) {
                        return (
                          <a
                            key={link.href}
                            href={link.href}
                            onClick={handleLinkClick(link.href)}
                            className={`rounded-lg px-3 py-2.5 text-sm transition-all ${
                              active
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {link.label}
                          </a>
                        )
                      }

                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setMobileOpen(false)}
                          className="rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-all hover:text-foreground"
                        >
                          {link.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}

            <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
              <Button
                asChild
                variant="ghost"
                className="w-full justify-center text-muted-foreground hover:text-foreground focus-visible:ring-primary/60"
              >
                <Link href="/login" onClick={() => setMobileOpen(false)}>
                  Giriş Yap
                </Link>
              </Button>
              <Button
                asChild
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary/70"
              >
                <Link href="/register" onClick={() => setMobileOpen(false)}>
                  Kayıt Ol
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
