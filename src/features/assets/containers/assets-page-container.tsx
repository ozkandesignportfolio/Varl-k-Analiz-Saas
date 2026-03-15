"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAppShellSession } from "@/components/layout/AppShell";
import { usePlanIdentityContext, usePlanUsageContext } from "@/contexts/PlanContext";
import {
  AssetsDialogsSection,
  AssetsHeaderActions,
  AssetsListingSection,
} from "@/features/assets/components/assets-page-sections";
import type { AssetActivityItem, AssetDashboardRow } from "@/features/assets/components/assets-view-types";
import { useAssetsActions } from "@/features/assets/hooks/use-assets-actions";
import { useAssetsData } from "@/features/assets/hooks/useAssetsData";
import { useAssetsFilters } from "@/features/assets/hooks/useAssetsFilters";
import { canPlanUsePremiumMedia } from "@/lib/plans/premium-media";
import { createClient as getSupabaseBrowserClient } from "@/lib/supabase/client";

const AssetCreateDialog = dynamic(() =>
  import("@/features/assets/components/asset-create-dialog").then((mod) => mod.AssetCreateDialog),
);
const AssetEditDialog = dynamic(() =>
  import("@/features/assets/components/asset-edit-dialog").then((mod) => mod.AssetEditDialog),
);
const AuditHistoryPanel = dynamic(() =>
  import("@/components/audit-history-panel").then((mod) => mod.AuditHistoryPanel),
);

const EMPTY_PREVIEW_ACTIVITIES: AssetActivityItem[] = [];

export function AssetsPageContainer() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const { userId: appShellUserId } = useAppShellSession();
  const { plan, userId: planUserId, isLoading: isPlanLoading } = usePlanIdentityContext();
  const { assetLimit, setAssetCount } = usePlanUsageContext();
  const isPremiumMediaEnabled = canPlanUsePremiumMedia(plan);
  const initializedUserIdRef = useRef<string | null>(null);
  const isLoadingMoreAssetsRef = useRef(false);

  const [userId, setUserId] = useState("");
  const [hasValidSession, setHasValidSession] = useState(true);
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);
  const [selectedPreviewAssetId, setSelectedPreviewAssetId] = useState<string | null>(null);
  const [qrPreviewAssetId, setQrPreviewAssetId] = useState<string | null>(null);

  const {
    searchTerm,
    setSearchTerm,
    categoryFilter,
    setCategoryFilter,
    assetFilter,
    setAssetFilter,
    warrantyFilter,
    setWarrantyFilter,
    maintenanceFilter,
    setMaintenanceFilter,
    sortMode,
    setSortMode,
    viewMode,
    setViewMode,
    listQueryOptions,
    hasActiveFilters,
    clearFilters,
  } = useAssetsFilters();

  const {
    assets,
    setAssets,
    categories,
    totalAssetCount,
    assetsCursor,
    hasMoreAssets,
    isLoadingMoreAssets,
    thumbnailUrls,
    setThumbnailUrls,
    serviceActivityPreviewByAsset,
    setServiceActivityPreviewByAsset,
    isLoading,
    setIsLoading,
    feedback,
    setFeedback,
    refreshAssetCount,
    fetchCategoryOptions,
    fetchAssetsPage,
    dashboardRows,
    summary,
  } = useAssetsData({
    supabase,
    setAssetCount,
    userId,
    listQueryOptions,
  });

  const {
    categoryOptions,
    inputClassName,
    isSaving,
    isUpdating,
    editingAsset,
    isScannerOpen,
    setIsScannerOpen,
    isQuotaModalOpen,
    setIsQuotaModalOpen,
    createFormDefaults,
    createFormKey,
    mediaErrorMessage,
    editMediaErrorMessage,
    editExistingMedia,
    isEditMediaLoading,
    removingEditMediaId,
    mediaSummary,
    editMediaSummary,
    onCreateAsset,
    onStartEdit,
    onCancelEdit,
    onUpdateAsset,
    onDeleteAsset,
    onQrDetected,
    onMediaSelection,
    onEditMediaSelection,
    onRemoveExistingMedia,
  } = useAssetsActions({
    supabase,
    userId,
    plan,
    assetLimit,
    totalAssetCount,
    isPremiumMediaEnabled,
    listQueryOptions,
    refreshAssetCount,
    fetchCategoryOptions,
    fetchAssetsPage,
    setAssets,
    setThumbnailUrls,
    setServiceActivityPreviewByAsset,
    setFeedback,
    selectedPreviewAssetId,
    setSelectedPreviewAssetId,
    qrPreviewAssetId,
    setQrPreviewAssetId,
    onAuditRefresh: () => {
      setAuditRefreshKey((prev) => prev + 1);
    },
  });

  const initializePageUser = useCallback(
    async (currentUserId: string) => {
      if (initializedUserIdRef.current === currentUserId) {
        return;
      }

      initializedUserIdRef.current = currentUserId;
      setHasValidSession(true);
      setUserId(currentUserId);
      setIsLoading(true);
      await Promise.all([refreshAssetCount(currentUserId), fetchCategoryOptions(currentUserId)]);
    },
    [fetchCategoryOptions, refreshAssetCount, setIsLoading],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (isPlanLoading) {
        setIsLoading((prev) => (prev ? prev : true));
        return;
      }

      const resolvedUserId = planUserId ?? appShellUserId;
      if (!resolvedUserId) {
        initializedUserIdRef.current = null;
        setHasValidSession(false);
        setIsLoading(false);
        router.replace("/login");
        return;
      }

      if (cancelled) {
        return;
      }

      await initializePageUser(resolvedUserId);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [appShellUserId, initializePageUser, isPlanLoading, planUserId, router, setIsLoading]);

  const dashboardRowById = useMemo(() => new Map(dashboardRows.map((asset) => [asset.id, asset])), [dashboardRows]);

  const selectedPreviewAsset = useMemo(() => {
    if (!selectedPreviewAssetId) return null;
    return dashboardRowById.get(selectedPreviewAssetId) ?? null;
  }, [dashboardRowById, selectedPreviewAssetId]);

  const selectedPreviewActivities = useMemo(() => {
    if (!selectedPreviewAssetId) return EMPTY_PREVIEW_ACTIVITIES;
    return serviceActivityPreviewByAsset[selectedPreviewAssetId] ?? EMPTY_PREVIEW_ACTIVITIES;
  }, [selectedPreviewAssetId, serviceActivityPreviewByAsset]);

  const qrPreviewAsset = useMemo(() => {
    if (!qrPreviewAssetId) return null;
    return dashboardRowById.get(qrPreviewAssetId) ?? null;
  }, [dashboardRowById, qrPreviewAssetId]);

  useEffect(() => {
    if (!selectedPreviewAssetId || dashboardRowById.has(selectedPreviewAssetId)) {
      return;
    }

    const resetPreviewSelectionTimer = window.setTimeout(() => {
      setSelectedPreviewAssetId((current) => (current && !dashboardRowById.has(current) ? null : current));
    }, 0);

    return () => {
      window.clearTimeout(resetPreviewSelectionTimer);
    };
  }, [dashboardRowById, selectedPreviewAssetId]);

  const focusCreateAssetForm = useCallback(() => {
    const createForm = document.getElementById("asset-create-form");
    if (!createForm) return;
    createForm.scrollIntoView({ behavior: "smooth", block: "start" });
    createForm.querySelector<HTMLInputElement>("input[name='name']")?.focus();
  }, []);

  const onDetectedQrValue = useCallback(
    (value: string) => {
      void onQrDetected(value);
    },
    [onQrDetected],
  );

  const onLoadMoreAssets = useCallback(() => {
    if (!userId || !assetsCursor || isLoadingMoreAssets || isLoadingMoreAssetsRef.current) return;
    isLoadingMoreAssetsRef.current = true;
    void fetchAssetsPage(userId, {
      append: true,
      cursor: assetsCursor,
      ...listQueryOptions,
    }).finally(() => {
      isLoadingMoreAssetsRef.current = false;
    });
  }, [assetsCursor, fetchAssetsPage, isLoadingMoreAssets, listQueryOptions, userId]);

  const onOpenScanner = useCallback(() => {
    setIsScannerOpen(true);
  }, [setIsScannerOpen]);

  const onCloseScanner = useCallback(() => {
    setIsScannerOpen(false);
  }, [setIsScannerOpen]);

  const onSelectPreviewAsset = useCallback((asset: AssetDashboardRow) => {
    setSelectedPreviewAssetId(asset.id);
  }, []);

  const onShowAssetQr = useCallback((asset: AssetDashboardRow) => {
    setQrPreviewAssetId(asset.id);
  }, []);

  const onCloseAssetPreview = useCallback(() => {
    setSelectedPreviewAssetId(null);
  }, []);

  const onCloseQrPreview = useCallback(() => {
    setQrPreviewAssetId(null);
  }, []);

  const onUpgradeToPremium = useCallback(() => {
    router.push("/pricing");
  }, [router]);

  const quotaModalAssets = useMemo(
    () =>
      assets
        .slice(0, assetLimit ?? 3)
        .map((asset) => ({ id: asset.id, name: asset.name, category: asset.category })),
    [assetLimit, assets],
  );
  const shellActions = useMemo(
    () => <AssetsHeaderActions onCreateAsset={focusCreateAssetForm} onOpenScanner={onOpenScanner} />,
    [focusCreateAssetForm, onOpenScanner],
  );
  const shouldRenderDialogs = Boolean(
    isScannerOpen || qrPreviewAsset || selectedPreviewAsset || isQuotaModalOpen,
  );

  if (!hasValidSession) return null;

  return (
    <AppShell
      badge="Varlık Yönetimi"
      title="Varlıklar"
      subtitle="Tüm varlıklarınızı tek yerden yönetin."
      actions={shellActions}
    >
      {shouldRenderDialogs ? (
        <AssetsDialogsSection
          isScannerOpen={isScannerOpen}
          onCloseScanner={onCloseScanner}
          onDetectedQrValue={onDetectedQrValue}
          qrPreviewAsset={qrPreviewAsset}
          onCloseQrPreview={onCloseQrPreview}
          selectedPreviewAsset={selectedPreviewAsset}
          selectedPreviewActivities={selectedPreviewActivities}
          onCloseAssetPreview={onCloseAssetPreview}
          isQuotaModalOpen={isQuotaModalOpen}
          onQuotaModalOpenChange={setIsQuotaModalOpen}
          assetLimit={assetLimit ?? 3}
          quotaModalAssets={quotaModalAssets}
        />
      ) : null}

      <AssetsListingSection
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        assetFilter={assetFilter}
        onAssetFilterChange={setAssetFilter}
        warrantyFilter={warrantyFilter}
        onWarrantyFilterChange={setWarrantyFilter}
        maintenanceFilter={maintenanceFilter}
        onMaintenanceFilterChange={setMaintenanceFilter}
        sortMode={sortMode}
        onSortModeChange={setSortMode}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        categories={categories}
        totalAssetCount={totalAssetCount}
        summary={summary}
        isLoading={isLoading}
        dashboardRows={dashboardRows}
        hasActiveFilters={hasActiveFilters}
        thumbnailUrls={thumbnailUrls}
        onSelectAsset={onSelectPreviewAsset}
        onStartEdit={onStartEdit}
        onShowQr={onShowAssetQr}
        onDeleteAsset={onDeleteAsset}
        onFocusCreateAsset={focusCreateAssetForm}
        onClearFilters={clearFilters}
        hasMoreAssets={hasMoreAssets}
        isLoadingMoreAssets={isLoadingMoreAssets}
        onLoadMore={onLoadMoreAssets}
      />

      <AssetCreateDialog
        createFormKey={createFormKey}
        defaults={createFormDefaults}
        onSubmit={onCreateAsset}
        isSubmitting={isSaving}
        categoryOptions={categoryOptions}
        inputClassName={inputClassName}
        isPremiumMediaEnabled={isPremiumMediaEnabled}
        mediaErrorMessage={mediaErrorMessage}
        mediaSummary={mediaSummary}
        onMediaSelection={onMediaSelection}
        onUpgradeToPremium={onUpgradeToPremium}
      />

      {editingAsset ? (
        <AssetEditDialog
          asset={editingAsset}
          onCancel={onCancelEdit}
          onSubmit={onUpdateAsset}
          isSubmitting={isUpdating}
          categoryOptions={categoryOptions}
          inputClassName={inputClassName}
          isPremiumMediaEnabled={isPremiumMediaEnabled}
          mediaErrorMessage={editMediaErrorMessage}
          mediaSummary={editMediaSummary}
          onMediaSelection={onEditMediaSelection}
          existingMediaItems={editExistingMedia}
          isLoadingExistingMedia={isEditMediaLoading}
          removingExistingMediaId={removingEditMediaId}
          onRemoveExistingMedia={onRemoveExistingMedia}
        />
      ) : null}

      {feedback ? (
        <p
          className="rounded-xl border border-sky-300/25 bg-sky-300/10 px-4 py-3 text-sm text-sky-100"
          data-testid="assets-feedback"
        >
          {feedback}
        </p>
      ) : null}

      <AuditHistoryPanel
        title="Varlık Değişim Geçmişi"
        subtitle="Varlık kayıtlarındaki oluşturma, güncelleme ve silme hareketlerini izleyin."
        entityTypes={["assets"]}
        limit={15}
        refreshKey={auditRefreshKey}
        currentUserId={userId}
      />
    </AppShell>
  );
}
