import type { DbClient, RepoResult } from "./_shared";
import {
  listForReportsPaginated as listDocumentsForReportsPaginated,
  type ListDocumentsForReportsWithAssetRow,
  type ReportsDocumentsCursor,
} from "./documents-repo";
import {
  listForReportsPaginated as listServiceLogsForReportsPaginated,
  type ListServiceLogsForReportsRow,
  type ReportsServiceLogsCursor,
} from "./service-logs-repo";

export type ReportsCursor = {
  services: ReportsServiceLogsCursor | null;
  documents: ReportsDocumentsCursor | null;
};

export type ListReportsParams = {
  userId: string;
  from?: string;
  to?: string;
  cursor?: ReportsCursor | null;
  pageSize?: number;
  includeServices?: boolean;
  includeDocuments?: boolean;
};

export type ListReportsResult = {
  services: ListServiceLogsForReportsRow[];
  documents: ListDocumentsForReportsWithAssetRow[];
  nextCursor: ReportsCursor;
  hasMore: boolean;
  hasMoreServices: boolean;
  hasMoreDocuments: boolean;
};

export async function listReports(
  client: DbClient,
  params: ListReportsParams,
): RepoResult<ListReportsResult> {
  const cursor = params.cursor ?? { services: null, documents: null };
  const includeServices = params.includeServices ?? true;
  const includeDocuments = params.includeDocuments ?? true;

  const [servicesRes, documentsRes] = await Promise.all([
    includeServices
      ? listServiceLogsForReportsPaginated(client, {
          userId: params.userId,
          startDate: params.from,
          endDate: params.to,
          pageSize: params.pageSize,
          cursor: cursor.services,
        })
      : Promise.resolve({ data: { rows: [], nextCursor: null, hasMore: false }, error: null }),
    includeDocuments
      ? listDocumentsForReportsPaginated(client, {
          userId: params.userId,
          startDate: params.from,
          endDate: params.to,
          pageSize: params.pageSize,
          cursor: cursor.documents,
        })
      : Promise.resolve({ data: { rows: [], nextCursor: null, hasMore: false }, error: null }),
  ]);

  if (servicesRes.error) {
    return { data: null, error: servicesRes.error };
  }
  if (documentsRes.error) {
    return { data: null, error: documentsRes.error };
  }

  const servicesData = servicesRes.data ?? { rows: [], nextCursor: null, hasMore: false };
  const documentsData = documentsRes.data ?? { rows: [], nextCursor: null, hasMore: false };

  return {
    data: {
      services: servicesData.rows,
      documents: documentsData.rows,
      nextCursor: {
        services: servicesData.nextCursor,
        documents: documentsData.nextCursor,
      },
      hasMore: servicesData.hasMore || documentsData.hasMore,
      hasMoreServices: servicesData.hasMore,
      hasMoreDocuments: documentsData.hasMore,
    },
    error: null,
  };
}
