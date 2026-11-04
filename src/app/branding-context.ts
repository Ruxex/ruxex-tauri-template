import { createContext, useContext } from "react";

import type { Branding } from "../platform/branding";

export const BrandingContext = createContext<Branding | null>(null);

export function useBranding(): Branding | null {
  return useContext(BrandingContext);
}
