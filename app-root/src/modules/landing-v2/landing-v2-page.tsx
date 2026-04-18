import { AbonelikSection } from "@/modules/landing-v2/components/abonelik-section";
import { AnimatedBackground } from "@/modules/landing-v2/components/AnimatedBackground";
import { BildirimSection } from "@/modules/landing-v2/components/bildirim-section";
import { FaturaSection } from "@/modules/landing-v2/components/fatura-section";
import { FeaturesSection } from "@/modules/landing-v2/components/features-section";
import { Footer } from "@/modules/landing-v2/components/footer";
import { HeroSection } from "@/modules/landing-v2/components/hero-section";
import { Navbar } from "@/modules/landing-v2/components/navbar";
import { PricingSection } from "@/modules/landing-v2/components/pricing-section";
import { ScoreAnalysisSection } from "@/modules/landing-v2/components/score-analysis-section";
import { DashboardPreviewLazy } from "@/modules/landing-v2/components/dashboard-preview-lazy";
import styles from "@/modules/landing-v2/landing-v2.module.css";

// Debug badge visibility is controlled by environment + an explicit feature
// flag so prod stays clean by default while the message itself is retained.
// Enable explicitly by setting NEXT_PUBLIC_SHOW_LANDING_DEBUG_BADGE=true.
const SHOW_LANDING_DEBUG_BADGE =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_SHOW_LANDING_DEBUG_BADGE === "true";

export function LandingV2Page() {
  return (
    <main className={`${styles.scope} relative min-h-screen min-h-[100svh] overflow-x-hidden bg-background`}>
      {/* DEBUG MARKER - shown only outside production or when flag enabled.
          Message text is intentionally preserved. */}
      {SHOW_LANDING_DEBUG_BADGE && (
        <div
          data-debug="landing-v2-active"
          aria-hidden="true"
          style={{
            position: 'fixed',
            top: 8,
            right: 8,
            zIndex: 99999,
            background: 'rgba(15, 23, 42, 0.55)',
            color: 'rgba(226, 232, 240, 0.85)',
            padding: '2px 8px',
            fontSize: '10px',
            fontWeight: 500,
            letterSpacing: '0.04em',
            borderRadius: '9999px',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            backdropFilter: 'blur(6px)',
            fontFamily: 'system-ui, sans-serif',
            pointerEvents: 'none',
            opacity: 0.7,
          }}
        >
          LANDING V2 ACTIVE - MUST BE VISIBLE IN PROD
        </div>
      )}
      <div className="relative z-10">
        <Navbar />
        <HeroSection />
        <FeaturesSection />
        <DashboardPreviewLazy />
        <BildirimSection />
        <AbonelikSection />
        <FaturaSection />
        <ScoreAnalysisSection />
        <PricingSection />
        <Footer />
      </div>
      <AnimatedBackground />
    </main>
  );
}

export default LandingV2Page;
