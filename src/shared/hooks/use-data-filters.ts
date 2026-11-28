"use client";
import { useEffect, useRef, useState } from "react";
import { parseAsInteger, parseAsString, useQueryState, useQueryStates } from "nuqs";
import { useDebounce } from "./use-debounce";

interface FilterOptions {
  debounceDelay?: number;
  /** Name of the search field, in both `activeFilters` and the URL (?search=...). */
  searchKey?: string;
}

/**
 * List filters (search, page, custom filters) stored in the URL query string instead of component state,
 * so they survive opening a detail page and coming back, a refresh, and sharing the link.
 *
 * - Values equal to their default are removed from the URL (nuqs `clearOnDefault`), keeping URLs clean.
 * - Updates replace the current history entry (nuqs default), so Back leaves the list instead of undoing filters.
 * - Filter values are strings (select values, ids, statuses). Encode other types at the call site.
 * - Pages using this must render it inside a <Suspense> boundary (it reads the URL search params).
 */
export function useDataFilters<T extends Record<string, string>>(
  initialFilters: T,
  options: FilterOptions = {},
) {
  const { debounceDelay = 500, searchKey = "search" } = options;

  // Built once from the initial shape so parser identity is stable across renders.
  const [filterParsers] = useState(() =>
    Object.fromEntries(Object.entries(initialFilters).map(([key, value]) => [key, parseAsString.withDefault(value)])),
  );
  const [urlFilters, setUrlFilters] = useQueryStates(filterParsers);
  const [page, setUrlPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [urlSearch, setUrlSearch] = useQueryState(searchKey, parseAsString.withDefault(""));

  // Search keeps a local value so typing stays instant, and writes to the URL only after the debounce.
  const [searchTitle, setSearchTitle] = useState(urlSearch);
  const debouncedSearch = useDebounce(searchTitle, debounceDelay);
  const lastSynced = useRef(urlSearch); // last value known to be in sync between input and URL

  useEffect(() => {
    // input -> URL. No-op on mount (debounced === URL), so a restored page number is not reset.
    if (debouncedSearch === lastSynced.current) return;
    lastSynced.current = debouncedSearch;
    void setUrlSearch(debouncedSearch);
  }, [debouncedSearch, setUrlSearch]);

  useEffect(() => {
    // URL -> input, for browser Back/Forward between filter states. Ignores our own writes,
    // so a slow URL update can never overwrite characters the user typed in the meantime.
    if (urlSearch === lastSynced.current) return;
    lastSynced.current = urlSearch;
    setSearchTitle(urlSearch);
  }, [urlSearch]);

  const filters = urlFilters as T;
  const activeFilters = { ...filters, [searchKey]: debouncedSearch };

  const setPage = (next: number) => void setUrlPage(next);

  const handleFilterChange = (field: keyof T & string, value: string) => {
    void setUrlFilters({ [field]: value });
    void setUrlPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchTitle(value);
    void setUrlPage(1);
  };

  const resetFilters = (overrides?: Partial<T>) => {
    setSearchTitle("");
    lastSynced.current = "";
    void setUrlSearch(null);
    void setUrlFilters(overrides ? { ...initialFilters, ...overrides } : null);
    void setUrlPage(1);
  };

  return {
    page,
    setPage,
    searchTitle,
    filters,
    activeFilters,
    handleFilterChange,
    handleSearchChange,
    resetFilters,
  };
}
