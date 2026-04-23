import { Suspense } from "react";
import BillingSuccessContent from "./billing-success-content";

export default function BillingSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col items-center justify-center px-6 text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
          <h1 className="text-3xl font-semibold text-white">Yükleniyor...</h1>
        </main>
      }
    >
      <BillingSuccessContent />
    </Suspense>
  );
}
