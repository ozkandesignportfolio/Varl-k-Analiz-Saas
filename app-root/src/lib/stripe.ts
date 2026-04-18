import "server-only";

// Compat shim — yeni tüketiciler `@/lib/services/stripe` import etsin.
// Tek resmi API: `getStripeClient()` (asla null dönmez, geçersiz yapılandırmada
// throw eder).
export { getStripeClient } from "@/lib/services/stripe";
