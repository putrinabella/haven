"use client";
import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RETURN_TO_PARAM, safeReturnTo, withReturnTo } from "@/lib/url-state/return-to";

/**
 * In a LIST page: returns a function that decorates detail links so they remember the current
 * filters:  <Link href={toDetail(`/items/${id}`)}>. Needs a <Suspense> boundary (reads search params).
 */
export function useReturnToHref() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  return useCallback((href: string) => withReturnTo(href, pathname, search), [pathname, search]);
}

/**
 * In a DETAIL page: returns a "back" handler that goes to the list with its filters restored,
 * or to `fallback` when there is no (valid) returnTo. Reads the URL at click time, so it adds no
 * render-time dependency on search params.
 */
export function useBackToList(fallback: string) {
  const router = useRouter();
  return useCallback(() => {
    const value = new URLSearchParams(window.location.search).get(RETURN_TO_PARAM);
    router.push(safeReturnTo(value, fallback));
  }, [router, fallback]);
}
