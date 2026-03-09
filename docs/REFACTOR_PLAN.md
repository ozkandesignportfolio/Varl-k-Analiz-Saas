# Refactor Plan

## A) Ön Analiz (Değişiklik Öncesi Bulgular)

### En büyük dosyalar (ilk 20, `src/` odaklı)
1. `src/features/assets/containers/assets-page-container.tsx`
2. `src/app/api/service-media/route.ts`
3. `src/lib/dashboard-queries.ts` (refactor sonrası `src/features/dashboard/api/dashboard-queries.ts`)
4. `src/app/costs/page.tsx`
5. `src/lib/services/billing-service.ts`
6. `src/features/billing/containers/billing-page-container.tsx`
7. `src/features/dashboard/components/ControlCenterHeader.tsx`
8. `src/features/dashboard/components/RisksAndUpcoming.tsx`
9. `src/features/reports/containers/reports-page-container.tsx`
10. `src/modules/landing-v2/components/skor-section.tsx`
11. `src/features/services/containers/services-page-container.tsx`
12. `src/features/dashboard/containers/dashboard-page-container.tsx` (eski client sürüm)
13. `src/app/documents/page.tsx`
14. `src/app/api/service-logs/route.ts`
15. `src/features/maintenance/containers/maintenance-page-container.tsx`
16. `src/app/api/maintenance-predictions/route.ts`
17. `src/features/assets/components/asset-form.tsx`
18. `src/app/api/assets/route.ts`
19. `src/app/assets/[id]/page.tsx`
20. `src/components/layout/Sidebar.tsx`

### En çok import edilen shared bileşenler (ilk 20)
- `@/components/app-shell`
- `@/components/ui/button`
- `@/components/ui/badge`
- `@/components/ui/tabs`
- `@/components/panel-surface` (refactor sonrası `@/components/shared/panel-surface`)
- `@/components/page-header` (refactor sonrası `@/components/shared/page-header`)
- `@/components/layout/AppShell`
- `@/components/ui/dialog`
- `@/components/legal/LegalLayout`
- `@/components/ui/card`
- `@/components/ui/Surface`
- `@/components/audit-history-panel`
- `@/components/guided-empty-state` (refactor sonrası `@/components/shared/guided-empty-state`)
- `@/components/ui/accordion`
- `@/components/ui/dropdown-menu`
- `@/components/qr-scanner-modal`
- `@/components/ui/QuotaExceededModal`
- `@/components/onboarding/OnboardingWizard`
- `@/components/ui/UpgradeGate`
- `@/components/ui/tooltip`

### Kullanılmayan dosya/export taraması
- `npx tsc --noEmit`: geçti
- `npx ts-prune`: Next App Router entrypoint’leri için gürültülü çıktı
- Yüksek güvenli dead-code adayları tespit edilip temizlendi (aşağıdaki silinen dosyalar)

### Placeholder route / “henüz-yakında” içerikleri
- Placeholder içerik tespit edilen route’lar:
  - `src/app/contact/page.tsx`
  - `src/app/demo/page.tsx`
- “Henüz” ifadelerinin önemli kısmı runtime empty-state/uyarı metni olarak bırakıldı.

### App Router route wiring kontrolü
- `/assets` -> `AssetsPageContainer` bağlı
- `/maintenance` -> `MaintenancePageContainer` bağlı (Suspense içinde)
- `/notifications` -> route sadece container render ediyor
- `/settings` -> route sadece container render ediyor (Suspense içinde)

### Mock data / sabit KPI kullanımı
- Bildirim mock verisi:
  - `src/features/notifications/data/mock-notifications.ts`
  - `src/features/notifications/notifications-page-container.tsx`
- Dashboard KPI/özet:
  - `src/features/dashboard/components/KPICards.tsx`
  - `src/features/dashboard/components/UsageLimitsCard.tsx`

---

## Uygulanan Refactor Adımları

1. Dashboard modülü App Router uyumlu hale getirildi.
2. Dashboard veri katmanı `features/dashboard/api` altına taşındı.
3. Shared parçalar `src/components/shared` altına çıkarıldı.
4. Notifications mock fallback production’da kapatılabilir flag’e bağlandı.
5. Settings route sadeleştirildi (route sadece container render eder).
6. Kullanılmayan component/hook dosyaları temizlendi.
7. Seçili `toUpperCase` noktaları `toLocaleUpperCase("tr-TR")` olarak güncellendi.

## Kalite kapısı
- Her ana adımda `npm run lint` ve `npm run build` çalıştırıldı.
- Son durum: lint ve build başarılı.
