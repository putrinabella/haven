"use client";

import { handleApiError } from "@/lib/error-handler";
import { useEffect } from "react";
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

interface UseBaseAllProps<T, TParams = unknown, TError = Error> {
  queryKey: readonly unknown[];

  fetcher: (params?: TParams) => Promise<T[]>;
  params?: TParams;
  enabled?: boolean;
  options?: Omit<UseQueryOptions<T[], TError>, "queryKey" | "queryFn">;
}

export function useBaseAll<T, TParams = unknown, TError = Error>({
  queryKey,
  fetcher,
  params,
  enabled = true,
  options,
}: UseBaseAllProps<T, TParams, TError>) {
  const query = useQuery({
    queryKey,

    queryFn: () => fetcher(params),
    enabled,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    ...options,
  });

  // Side effects belong in an effect, not in render (render can run many times).
  useEffect(() => {
    if (query.error) handleApiError(query.error);
  }, [query.error]);

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
