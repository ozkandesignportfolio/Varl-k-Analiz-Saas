"use client"

import Link from "next/link"
import { useEffect, useRef, useState, type MouseEvent } from "react"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LANDING_NAV_SECTIONS, isLandingSectionHash } from "@/modules/landing-v2/components/section-nav"

const DEFAULT_SECTION = LANDING_NAV_SECTIONS[0]?.href ?? "#ozellikler"

const getFocusableElements = (container: HTMLElement) =>
  Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  )

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeHref, setActiveHref] = useState<string>(DEFAULT_SECTION)
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  const mobileToggleRef = useRef<HTMLButtonElement>(null)

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
      if (frame !== null) {
        window.cancelAnimationFrame(frame)
      }
      window.removeEventListener("scroll", handleScroll)
    }
  }, [])

  useEffect(() => {
    const updateActiveSection = () => {
      const scrollOffset = 128
      let current: string = DEFAULT_SECTION

      for (const link of LANDING_NAV_SECTIONS) {
        const section = document.getElementById(link.href.slice(1))
        if (!section) continue

        const top = section.getBoundingClientRect().top
        if (top - scrollOffset <= 0) {
          current = link.href
        }
      }

      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
      if (atBottom) {
        current = LANDING_NAV_SECTIONS[LANDING_NAV_SECTIONS.length - 1]?.href ?? current
      }

      setActiveHref((prev) => (prev === current ? prev : current))
    }

    updateActiveSection()
    window.addEventListener("scroll", updateActiveSection, { passive: true })
    window.addEventListener("resize", updateActiveSection)

    return () => {
      window.removeEventListener("scroll", updateActiveSection)
      window.removeEventListener("resize", updateActiveSection)
    }
  }, [])

  useEffect(() => {
    const syncHash = () => {
      const hash = window.location.hash
      if (isLandingSectionHash(hash)) {
        setActiveHref(hash)
      }
    }

    syncHash()
    window.addEventListener("hashchange", syncHash)

    return () => window.removeEventListener("hashchange", syncHash)
  }, [])

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
      if (focusableElements.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusableElements[0]
      const last = focusableElements[focusableElements.length - 1]
      const activeElement = document.activeElement as HTMLElement | null

      if (event.shiftKey) {
        if (!activeElement || activeElement === first) {
          event.preventDefault()
          last.focus()
        }
        return
      }

      if (activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleKeydown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", handleKeydown)
    }
  }, [mobileOpen])

  const handleSectionClick = (href: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()

    const section = document.getElementById(href.slice(1))
    if (!section) return

    section.scrollIntoView({ behavior: "smooth", block: "start" })
    window.history.replaceState(null, "", href)
    setActiveHref(href)
    setMobileOpen(false)
  }

  return (
    <nav
      className={`landing-v2-nav fixed top-0 left-0 right-0 z-[60] transition-all duration-500 ${
        scrolled ? "glass-card py-3 shadow-lg shadow-[#050a18]/50" : "bg-transparent py-5"
      }`}
    >
      <div className="relative z-[60] mx-auto flex max-w-7xl items-center justify-between px-6">
        <a href="#" className="group flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 transition-all group-hover:border-primary/40 group-hover:bg-primary/20">
            <img src="/assetly-mark.svg" alt="" aria-hidden="true" className="h-6 w-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-foreground">ASSETLY</span>
            <span className="text-[10px] tracking-[0.2em] text-muted-foreground">Premium Kontrol Paneli</span>
          </div>
        </a>

        <div className="hidden items-center gap-1 lg:flex">
          {LANDING_NAV_SECTIONS.map((link) => {
            const isActive = activeHref === link.href

            return (
              <a
                key={link.href}
                href={link.href}
                data-state={isActive ? "active" : "idle"}
                aria-current={isActive ? "page" : undefined}
                onClick={handleSectionClick(link.href)}
                className="landing-v2-nav-link group rounded-lg px-4 py-2 text-sm text-muted-foreground transition-all hover:text-foreground"
              >
                <span className="relative z-[1]">{link.label}</span>
              </a>
            )
          })}
        </div>

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

      {mobileOpen && (
        <div
          ref={mobileMenuRef}
          id="landing-v2-mobile-menu"
          className="glass-card mt-2 mx-4 rounded-2xl p-6 lg:hidden animate-slide-up"
        >
          <div className="flex flex-col gap-2">
            {LANDING_NAV_SECTIONS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                data-state={activeHref === link.href ? "active" : "idle"}
                aria-current={activeHref === link.href ? "page" : undefined}
                onClick={handleSectionClick(link.href)}
                className="landing-v2-nav-link group rounded-lg px-4 py-3 text-sm text-muted-foreground transition-all hover:text-foreground"
              >
                <span className="relative z-[1]">{link.label}</span>
              </a>
            ))}
            <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
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
