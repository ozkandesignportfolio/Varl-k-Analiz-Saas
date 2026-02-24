import { AbonelikSection } from "@/modules/landing-v2/components/abonelik-section";
import { BildirimSection } from "@/modules/landing-v2/components/bildirim-section";
import { CTASection } from "@/modules/landing-v2/components/cta-section";
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
  return (
    <main className={`${styles.scope} min-h-screen overflow-x-hidden bg-background`}>
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <DashboardPreviewLazy />
      <BildirimSection />
      <AbonelikSection />
      <FaturaSection />
      <ScoreAnalysisSection />
      <PricingSection />
      <CTASection />
      <Footer />
    </main>
  );
}

export default LandingV2Page;
