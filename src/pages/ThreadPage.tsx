import { useOutletContext, useParams } from "react-router-dom";

import type { AppOutletContext } from "../app/app-outlet-context";
import { ConversationWorkspace } from "../components/conversation/ConversationWorkspace";

export function ThreadPage() {
  const { threadId = "" } = useParams<{ threadId: string }>();
  const outletContext = useOutletContext<AppOutletContext | undefined>();
  return (
    <ConversationWorkspace
      onOpenThreadDiff={outletContext?.openThreadDiff}
      onOpenThreadTerminal={outletContext?.openThreadTerminal}
      threadId={threadId}
    />
  );
}
