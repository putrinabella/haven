/**
 * Wire format of every /api/v1 response (success and error). Stable contract for first-party pages
 * and any future third-party client: change it only by adding fields, or ship /api/v2.
 */
export interface ApiResponse<T> {
  meta: {
    success: boolean;
    code: number;
    message: string;
    /** Same value as the x-request-id response header; quote it when reporting a problem. */
    requestId?: string;
    /** Stable machine-readable error code ("validation_failed", "forbidden", ...). */
    errorCode?: string;
  };
  data: T;
  errors?: { fieldErrors?: Record<string, string[]> };
}

/** Pagination block the server sends inside `data` for list endpoints. */
export interface PaginatedMeta {
  page: number;
  size: number;
  total: number;
  totalPages: number;
}

/** Client-side list shape consumed by useBaseList. Mapped from PaginatedMeta in createCrudService. */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  current_page: number;
  last_page: number;
  per_page: number;
  from: number;
  to: number;
}

export interface PaginatedParams {
  page?: number | string;
  size?: number | string;
  q?: string;
  sort?: string;
  dir?: "asc" | "desc";
  [key: string]: unknown;
}
export interface PageSearchProps {
  searchParams: Promise<PaginatedParams>;
}
export interface DynamicPageProps<T = Record<string, string>> {
  params: Promise<T>;
}
