import { Navigate, useParams } from "react-router-dom";

export function NewChatRedirect() {
  const { projectId } = useParams<{ projectId?: string }>();
  const target = projectId
    ? `/?projectId=${encodeURIComponent(projectId)}`
    : "/";
  return <Navigate replace to={target} />;
}
