"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient as getSupabaseBrowserClient } from "@/lib/supabase/client";

export type MediaEnrichmentUiStatus = "queued" | "processing" | "succeeded" | "failed" | null;

type JobStatusRow = {
  id: string;
  status: MediaEnrichmentUiStatus;
  updated_at: string;
};

export function useMediaEnrichmentJobStatus(jobId: string | null, options?: { intervalMs?: number; enabled?: boolean }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const enabled = (options?.enabled ?? true) && Boolean(jobId);
  const intervalMs = Math.max(1_000, options?.intervalMs ?? 5_000);

  const [status, setStatus] = useState<MediaEnrichmentUiStatus>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLoadedJobId, setLastLoadedJobId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || !jobId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const { data, error: queryError } = await supabase
      .from("media_enrichment_jobs")
      .select("id,status,updated_at")
      .eq("id", jobId)
      .maybeSingle();

    if (queryError) {
      setError(queryError.message);
      setLastLoadedJobId(jobId);
      setIsLoading(false);
      return;
    }

    const row = (data ?? null) as JobStatusRow | null;
    setStatus(row?.status ?? null);
    setUpdatedAt(row?.updated_at ?? null);
    setLastLoadedJobId(jobId);
    setIsLoading(false);
  }, [enabled, jobId, supabase]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const initialTimer = setTimeout(() => {
      void refresh();
    }, 0);

    const timer = setInterval(() => {
      void refresh();
    }, intervalMs);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(timer);
    };
  }, [enabled, intervalMs, refresh]);

  const hasCurrentJobSnapshot = enabled && lastLoadedJobId === jobId;

  return {
    status: hasCurrentJobSnapshot ? status : null,
    updatedAt: hasCurrentJobSnapshot ? updatedAt : null,
    isLoading: enabled ? isLoading : false,
    error: enabled ? error : null,
    refresh,
  };
}

