import { buildQueryString } from "./queryBuilder";
import { ApiError, apiFetch } from "./apiFetch";
import type { ApiResponse, PaginatedMeta, PaginatedParams, PaginatedResponse } from "../types/common";

/**
 * Typed browser client for a standard REST resource under /api/v1:
 *   GET /x?page&size&q  GET /x/{id}  POST /x  PUT /x/{id}  DELETE /x/{id}
 * Plain fetches, no Next data-cache options: the data is per user/household, so caching belongs
 * to TanStack Query on the client, never to a shared server-side fetch cache.
 */
export function createCrudService<T>(basePath: string) {
  const itemPath = (id: string) => `${basePath}/${encodeURIComponent(id)}`;

  return {
    async getPaginated(params: PaginatedParams = { page: 1, size: 15 }): Promise<PaginatedResponse<T>> {
      const json = await apiFetch<ApiResponse<{ items: T[]; meta: PaginatedMeta }>>(
        `${basePath}${buildQueryString(params)}`,
      );
      const { items, meta } = json.data;
      const from = items.length ? (meta.page - 1) * meta.size + 1 : 0;
      return {
        items,
        total: meta.total,
        current_page: meta.page,
        last_page: meta.totalPages,
        per_page: meta.size,
        from,
        to: items.length ? from + items.length - 1 : 0,
      };
    },

    async getAll(params: PaginatedParams = {}): Promise<T[]> {
      const json = await apiFetch<ApiResponse<T[]>>(`${basePath}${buildQueryString(params)}`);
      return json.data;
    },

    /** null ONLY for 404; auth, validation and server errors still throw so they are not mistaken for "missing". */
    async getDetail(id: string): Promise<T | null> {
      try {
        const json = await apiFetch<ApiResponse<T>>(itemPath(id));
        return json.data ?? null;
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }
    },

    async create(payload: Partial<T>): Promise<T> {
      const json = await apiFetch<ApiResponse<T>>(basePath, { method: "POST", body: JSON.stringify(payload) });
      return json.data;
    },

    async update(id: string, payload: Partial<T>): Promise<T> {
      const json = await apiFetch<ApiResponse<T>>(itemPath(id), { method: "PUT", body: JSON.stringify(payload) });
      return json.data;
    },

    async delete(id: string): Promise<void> {
      await apiFetch(itemPath(id), { method: "DELETE" });
    },
  };
}
