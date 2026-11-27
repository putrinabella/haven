// provider.tsx
"use client";
import { QueryClient, QueryClientProvider, isServer } from "@tanstack/react-query";

const make = () =>
  new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, gcTime: 10 * 60_000, refetchOnWindowFocus: false },
    },
  });
let browserClient: QueryClient | undefined;

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const client = isServer ? make() : (browserClient ??= make());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

