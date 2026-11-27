"use client";
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";

export const listParsers = {
  q: parseAsString.withDefault(""),
  page: parseAsInteger.withDefault(1),
  size: parseAsInteger.withDefault(15),
  sort: parseAsString.withDefault(""),
  dir: parseAsStringLiteral(["asc", "desc"] as const).withDefault("desc"),
};

export function useListState() {
  const [state, set] = useQueryStates(listParsers);
  return {
    state,
    setSearch: (q: string) => set({ q, page: 1 }, { history: "replace" }),
    setPage: (page: number) => set({ page }),
    setSort: (sort: string, dir: "asc" | "desc") => set({ sort, dir, page: 1 }),
    reset: () => set(null), // clears all keys back to defaults
  };
}