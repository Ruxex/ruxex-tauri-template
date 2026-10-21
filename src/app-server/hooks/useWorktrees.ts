import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { appServerQueryKeys } from "../query-keys";
import { isDesktopRuntime } from "../runtime";
import {
  createWorktree,
  listWorktrees,
  openWorktree,
  removeWorktree,
  type WorktreeCreateRequest,
} from "../../platform/worktrees";

export function useWorktrees(root: string) {
  const queryClient = useQueryClient();
  const queryKey = appServerQueryKeys.worktrees(root);
  const query = useQuery({
    queryKey,
    queryFn: () => listWorktrees(root),
    enabled: isDesktopRuntime && Boolean(root),
    retry: false,
  });
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey });
  };
  const create = useMutation({
    mutationFn: (request: WorktreeCreateRequest) => createWorktree(request),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: ({ path, force }: { path: string; force: boolean }) =>
      removeWorktree({ root, path, force }),
    onSuccess: invalidate,
  });
  const open = useMutation({
    mutationFn: (path: string) => openWorktree(root, path),
  });
  return { query, create, remove, open };
}
