import type { Metadata } from "next";
import { LegalLayout, LegalSection } from "@/components/legal/LegalLayout";

export const metadata: Metadata = {
  title: "Distance Sales Information | AssetCare",
  description: "Distance sales disclosure for AssetCare digital subscription services.",
};

export default function DistanceSalesPage() {
  return (
    <LegalLayout
      title="Distance Sales Information"
      subtitle="This text summarizes key provisions that apply when AssetCare subscriptions are purchased remotely through electronic channels. It is focused on digital service delivery and recurring monthly usage rights."
      lastUpdated="February 18, 2026"
    >
      <LegalSection title="1. Digital Service Definition">
        <p>
          AssetCare is delivered as an online digital service, not a physical good. Access is provided through account
          activation, and the purchased value corresponds to software usage rights, hosted infrastructure capacity, and
          ongoing service operations during the active subscription period.
        </p>
      </LegalSection>

      <LegalSection title="2. Instant Performance Clause">
        <p>
          Service performance begins immediately once account setup and subscription activation are completed. By
          confirming the order, the customer acknowledges that digital service delivery starts without delay and that
          access to premium capabilities may be enabled before the end of any general cooling-off period.
        </p>
      </LegalSection>

      <LegalSection title="3. Withdrawal Exception for Digital Services">
        <p>
          Where applicable law recognizes an exception for instantly performed digital services, withdrawal rights may
          be limited after service activation and explicit consent. This applies because the subscription provides
          immediate and measurable digital utility through platform access, storage allocation, and operational
          processing.
        </p>
      </LegalSection>

      <LegalSection title="4. Subscription Terms">
        <p>
          Subscriptions are monthly and renew automatically unless canceled before the next billing date. Charges are
          applied per cycle according to the active plan, and invoices are issued electronically. Cancellation prevents
          future renewals but does not retroactively invalidate the current paid monthly term.
        </p>
      </LegalSection>

      <LegalSection title="5. Contact and Support">
        <p>
          For distance sales questions, contract clarifications, or billing disputes, contact{" "}
          <a href="mailto:support@assetcare.app" className="text-sky-300 underline underline-offset-2">
            support@assetcare.app
          </a>{" "}
          with your account and invoice reference for faster review.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
