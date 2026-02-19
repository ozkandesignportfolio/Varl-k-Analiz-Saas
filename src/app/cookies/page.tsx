import type { Metadata } from "next";
import { LegalLayout, LegalSection } from "@/components/legal/LegalLayout";

export const metadata: Metadata = {
  title: "Cookie Policy | AssetCare",
  description: "Cookie usage and session technologies used by AssetCare.",
};

export default function CookiesPage() {
  return (
    <LegalLayout
      title="Cookie Policy"
      subtitle="This policy describes how AssetCare uses cookies and similar session technologies to keep the platform secure, stable, and usable. We prioritize essential technical cookies required for authenticated SaaS workflows."
      lastUpdated="February 18, 2026"
    >
      <LegalSection title="1. What Cookies Are Used For">
        <p>
          Cookies are small text files stored by your browser that help maintain login sessions, protect secure
          requests, preserve interface preferences, and improve reliability. In a business SaaS context, these controls
          are necessary to preserve continuity of authenticated work and reduce operational friction.
        </p>
      </LegalSection>

      <LegalSection title="2. Cookie Categories">
        <div className="premium-card overflow-x-auto p-0">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-white/5 text-slate-100">
              <tr>
                <th className="border border-white/10 px-3 py-2">Category</th>
                <th className="border border-white/10 px-3 py-2">Purpose</th>
                <th className="border border-white/10 px-3 py-2">Retention Window</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              <tr>
                <td className="border border-white/10 px-3 py-2 align-top">Strictly necessary</td>
                <td className="border border-white/10 px-3 py-2 align-top">
                  Authentication, CSRF protection, secure session continuity
                </td>
                <td className="border border-white/10 px-3 py-2 align-top">Session-limited or short-term</td>
              </tr>
              <tr>
                <td className="border border-white/10 px-3 py-2 align-top">Functional preferences</td>
                <td className="border border-white/10 px-3 py-2 align-top">
                  Remembering interface state and usability settings
                </td>
                <td className="border border-white/10 px-3 py-2 align-top">Up to 12 months</td>
              </tr>
              <tr>
                <td className="border border-white/10 px-3 py-2 align-top">Security telemetry markers</td>
                <td className="border border-white/10 px-3 py-2 align-top">
                  Detecting abuse patterns and session anomalies
                </td>
                <td className="border border-white/10 px-3 py-2 align-top">Up to 24 months</td>
              </tr>
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection title="3. Third-Party Cookie Controls">
        <p>
          AssetCare may rely on trusted infrastructure vendors for hosting, session handling, and delivery services.
          Where third-party technologies set technical cookies, usage is limited to service operation and protection.
          We do not rely on broad behavioral advertising cookies for the core product workflow.
        </p>
      </LegalSection>

      <LegalSection title="4. Managing Cookie Preferences">
        <p>
          You can manage cookies through browser settings; however, disabling strictly necessary cookies may prevent
          login persistence, secure requests, or key workflow features from functioning correctly. For managed company
          environments, administrators should align browser policy decisions with internal security requirements.
        </p>
      </LegalSection>

      <LegalSection title="5. Policy Updates">
        <p>
          Cookie practices may be updated as security controls, legal requirements, or platform architecture evolves.
          Material updates are published on this page with an updated effective date.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
