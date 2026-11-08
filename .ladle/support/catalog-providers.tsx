import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";

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
  return <div className="min-h-24 bg-base-100 p-4">{children}</div>;
}
