import { useParams } from "react-router-dom";

import { NewChatComposer } from "../components/chat/NewChatComposer";

export function NewChatPage() {
  const { projectId } = useParams<{ projectId?: string }>();
  return <NewChatComposer projectId={projectId} />;
}
