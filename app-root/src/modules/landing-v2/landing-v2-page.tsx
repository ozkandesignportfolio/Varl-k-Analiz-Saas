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

export function LandingV2Page() {
  // RUNTIME DEBUG - MUST APPEAR IN PROD BROWSER CONSOLE
  console.log("[ASSETLY DEBUG] LANDING V2 RENDERED", new Date().toISOString());
  return (
    <main className={`${styles.scope} relative min-h-screen min-h-[100svh] overflow-x-hidden bg-background`}>
      {/* DEBUG MARKER - MUST BE VISIBLE IN PROD */}
      <div
        data-debug="landing-v2-active"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 99999,
          background: '#ef4444',
          color: '#fff',
          padding: '12px 20px',
          fontSize: '14px',
          fontWeight: 'bold',
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        LANDING V2 ACTIVE - MUST BE VISIBLE IN PROD
      </div>
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
