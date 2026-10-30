import type { PropsWithChildren } from "react";

export function PageContainer({ children }: PropsWithChildren) {
  return <div className="mx-auto w-full max-w-5xl space-y-6">{children}</div>;
}
