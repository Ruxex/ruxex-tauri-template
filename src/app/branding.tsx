import { useEffect, useState } from "react";

import { isNativeDesktopRuntime } from "../app-server/runtime";
import { getBranding, type Branding } from "../platform/branding";
import { BrandingContext } from "./branding-context";

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<Branding | null>(null);

  useEffect(() => {
    if (!isNativeDesktopRuntime) {
      return;
    }
    let cancelled = false;
    void getBranding()
      .then((value) => {
        if (!cancelled) {
          setBranding(value);
          document.title = value.windowTitle;
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
}
