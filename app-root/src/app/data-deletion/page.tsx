import type { Metadata } from "next";
import { LegalLayout, LegalSection } from "@/components/legal/LegalLayout";

export const metadata: Metadata = {
  title: "Data Deletion Policy | Assetly",
  description: "How account deletion and data removal workflows operate in Assetly.",
};

export default function DataDeletionPage() {
  return (
    <LegalLayout
      title="Data Deletion Policy"
      subtitle="This page defines how Assetly executes account deletion requests, what data is removed, what records may remain due to legal obligations, and the expected processing timeline. The process is designed for traceability and controlled finalization."
      lastUpdated="February 18, 2026"
    >
      <LegalSection title="1. Account Deletion Flow">
        <p>
          Deletion requests must be initiated by the account owner or a legally authorized representative. Once a
          request is received, Assetly performs identity and authority validation, confirms account scope, and starts
          a controlled deletion workflow. During this process, account access may be restricted to prevent conflicting
          changes and preserve procedural integrity.
        </p>
      </LegalSection>

      <LegalSection title="2. Cascade Delete Behavior">
        <p>
          After validation, the workflow removes tenant-bound operational records, including asset entries, maintenance
          logs, uploaded evidence files, and associated metadata linked to the target account. Cascade deletion is
          executed in dependency order to avoid orphaned records and maintain referential integrity during teardown.
        </p>
      </LegalSection>

      <LegalSection title="3. Retained Records">
        <p>
          Certain records are retained even after account deletion where legal obligations apply. This may include
          invoices, tax-relevant billing entries, and limited audit logs required for fraud prevention, regulatory
          response, or accounting compliance. Retained data is access-limited and excluded from active product
          workflows.
        </p>
      </LegalSection>

      <LegalSection title="4. Time Windows">
        <div className="premium-card overflow-x-auto p-0">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-white/5 text-slate-100">
              <tr>
                <th className="border border-white/10 px-3 py-2">Stage</th>
                <th className="border border-white/10 px-3 py-2">Target Window</th>
                <th className="border border-white/10 px-3 py-2">Notes</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              <tr>
                <td className="border border-white/10 px-3 py-2 align-top">Request acknowledgment</td>
                <td className="border border-white/10 px-3 py-2 align-top">Within 3 business days</td>
                <td className="border border-white/10 px-3 py-2 align-top">
                  Includes identity and authorization checklist
                </td>
              </tr>
              <tr>
                <td className="border border-white/10 px-3 py-2 align-top">Operational data purge</td>
                <td className="border border-white/10 px-3 py-2 align-top">Within 30 days after validation</td>
                <td className="border border-white/10 px-3 py-2 align-top">
                  Covers tenant records and file storage objects
                </td>
              </tr>
              <tr>
                <td className="border border-white/10 px-3 py-2 align-top">Backup lifecycle expiration</td>
                <td className="border border-white/10 px-3 py-2 align-top">Up to 60 additional days</td>
                <td className="border border-white/10 px-3 py-2 align-top">
                  Time-limited residual copies in secure backup rotation
                </td>
              </tr>
              <tr>
                <td className="border border-white/10 px-3 py-2 align-top">Mandatory billing retention</td>
                <td className="border border-white/10 px-3 py-2 align-top">As required by law</td>
                <td className="border border-white/10 px-3 py-2 align-top">
                  Restricted access for legal and accounting purposes
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection title="5. Deletion Confirmation and Contact">
        <p>
          When the deletion workflow is completed, Assetly sends a closure confirmation to the authorized requester
          with a summary of executed actions and legally retained record categories. Questions about active requests can
          be directed to{" "}
          <a href="mailto:assetly@gmail.com" className="text-sky-300 underline underline-offset-2">
            assetly@gmail.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
