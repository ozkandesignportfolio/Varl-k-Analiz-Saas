import { useCallback, useEffect, useMemo, useState } from "react";
import {
  REPORTS_PAGE_SIZE,
  type DocumentRow,
  type ReportsCursor,
  type ReportsPageResponse,
  type ServiceRow,
  toEndOfDay,
  toStartOfDay,
} from "@/features/reports/lib/reports-page-utils";

type UseReportsRowsArgs = {
  userId: string;
  startDate: string;
  endDate: string;
  onError: (message: string) => void;
};

const EMPTY_CURSOR: ReportsCursor = { services: null, documents: null };

const toPageData = (
  payload: (ReportsPageResponse & { error?: never }) | { error?: string } | null,
): ReportsPageResponse => {
  if (payload && "nextCursor" in payload) {
    return {
      services: payload.services ?? [],
      documents: payload.documents ?? [],
      nextCursor: payload.nextCursor ?? EMPTY_CURSOR,
      hasMore: payload.hasMore ?? false,
      hasMoreServices: payload.hasMoreServices ?? false,
      hasMoreDocuments: payload.hasMoreDocuments ?? false,
    };
  }

  return {
    services: [],
    documents: [],
    nextCursor: EMPTY_CURSOR,
    hasMore: false,
    hasMoreServices: false,
    hasMoreDocuments: false,
  };
};

export function useReportsRows({
  userId,
  startDate,
  endDate,
  onError,
}: UseReportsRowsArgs) {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [reportCursor, setReportCursor] = useState<ReportsCursor>(EMPTY_CURSOR);
  const [hasMoreRows, setHasMoreRows] = useState(false);
  const [hasMoreServices, setHasMoreServices] = useState(false);
  const [hasMoreDocuments, setHasMoreDocuments] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMoreRows, setIsLoadingMoreRows] = useState(false);

  const rangeStart = useMemo(() => toStartOfDay(startDate), [startDate]);
  const rangeEnd = useMemo(() => toEndOfDay(endDate), [endDate]);
  const hasValidRange = useMemo(() => {
    const start = rangeStart.getTime();
    const end = rangeEnd.getTime();
    return !Number.isNaN(start) && !Number.isNaN(end) && start <= end;
  }, [rangeEnd, rangeStart]);

  const fetchReportRows = useCallback(
    async (options: {
      append: boolean;
      cursor: ReportsCursor | null;
      startDateValue: string;
      endDateValue: string;
      includeServices?: boolean;
      includeDocuments?: boolean;
    }) => {
      if (options.append) {
        setIsLoadingMoreRows(true);
      } else {
        setIsLoading(true);
      }

      const query = new URLSearchParams();
      query.set("from", options.startDateValue);
      query.set("to", options.endDateValue);
      query.set("pageSize", String(REPORTS_PAGE_SIZE));
      query.set("includeServices", (options.includeServices ?? true) ? "1" : "0");
      query.set("includeDocuments", (options.includeDocuments ?? true) ? "1" : "0");

      if (options.cursor?.services?.createdAt) {
        query.set("servicesCursorCreatedAt", options.cursor.services.createdAt);
      }
      if (options.cursor?.services?.id) {
        query.set("servicesCursorId", options.cursor.services.id);
      }
      if (options.cursor?.documents?.uploadedAt) {
        query.set("documentsCursorUploadedAt", options.cursor.documents.uploadedAt);
      }
      if (options.cursor?.documents?.id) {
        query.set("documentsCursorId", options.cursor.documents.id);
      }

      const response = await fetch(`/api/reports?${query.toString()}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      const payload = (await response.json().catch(() => null)) as
        | (ReportsPageResponse & { error?: never })
        | { error?: string }
        | null;

      if (!response.ok) {
        onError(payload?.error ?? "Rapor satırları yüklenemedi.");
        if (options.append) {
          setIsLoadingMoreRows(false);
        } else {
          setIsLoading(false);
        }
        return;
      }

      const pageData = toPageData(payload);
      const nextServices = pageData.services as ServiceRow[];
      const nextDocuments = pageData.documents as DocumentRow[];

      setHasMoreRows(pageData.hasMore);
      setHasMoreServices(pageData.hasMoreServices);
      setHasMoreDocuments(pageData.hasMoreDocuments);
      setReportCursor(pageData.nextCursor);

      if (options.append) {
        setServices((prev) => [...prev, ...nextServices]);
        setDocuments((prev) => [...prev, ...nextDocuments]);
        setIsLoadingMoreRows(false);
        return;
      }

      setServices(nextServices);
      setDocuments(nextDocuments);
      setIsLoading(false);
    },
    [onError],
  );

  useEffect(() => {
    if (!userId || !hasValidRange) {
      return;
    }

    const timer = setTimeout(() => {
      void fetchReportRows({
        append: false,
        cursor: null,
        startDateValue: startDate,
        endDateValue: endDate,
      });
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [endDate, fetchReportRows, hasValidRange, startDate, userId]);

  const loadMoreRows = useCallback(async () => {
    if (!userId || !hasValidRange || !hasMoreRows || isLoadingMoreRows) {
      return;
    }

    await fetchReportRows({
      append: true,
      cursor: {
        services: hasMoreServices ? reportCursor.services : null,
        documents: hasMoreDocuments ? reportCursor.documents : null,
      },
      startDateValue: startDate,
      endDateValue: endDate,
      includeServices: hasMoreServices,
      includeDocuments: hasMoreDocuments,
    });
  }, [
    endDate,
    fetchReportRows,
    hasMoreDocuments,
    hasMoreRows,
    hasMoreServices,
    hasValidRange,
    isLoadingMoreRows,
    reportCursor.documents,
    reportCursor.services,
    startDate,
    userId,
  ]);

  const visibleServices = useMemo(() => (hasValidRange ? services : []), [hasValidRange, services]);
  const visibleDocuments = useMemo(() => (hasValidRange ? documents : []), [documents, hasValidRange]);
  const visibleHasMoreRows = hasValidRange ? hasMoreRows : false;
  const visibleIsLoading = hasValidRange ? isLoading : false;

  return {
    services: visibleServices,
    documents: visibleDocuments,
    hasValidRange,
    isLoading: visibleIsLoading,
    hasMoreRows: visibleHasMoreRows,
    isLoadingMoreRows,
    loadMoreRows,
  };
}
