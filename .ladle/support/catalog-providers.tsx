import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";

type CatalogQuerySeed = {
  data: unknown;
  queryKey: readonly unknown[];
};

type CatalogRouterProps = {
  children: ReactNode;
  initialEntries?: string[];
};

export function CatalogRouter({
  children,
  initialEntries = ["/"],
}: CatalogRouterProps) {
  return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>;
}

export function CatalogSurface({ children }: { children: ReactNode }) {
  return <div className="min-h-24 w-full bg-base-100 p-4">{children}</div>;
}

export function CatalogQueryProvider({
  children,
  seeds,
}: {
  children: ReactNode;
  seeds: CatalogQuerySeed[];
}) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
      },
    });
    for (const seed of seeds) {
      client.setQueryData(seed.queryKey, seed.data);
    }
    return client;
  });

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
