import { useSearchParams } from "react-router-dom";

import { NewChatComposer } from "@/components/composite/chat/NewChatComposer";

export function HomePage() {
  const [searchParams] = useSearchParams();
  return <NewChatComposer projectId={searchParams.get("projectId") ?? undefined} />;
}
