import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { v2 } from "../../protocol";
import { requestAppServerMethod } from "../api";
import {
  invalidateThreadList,
  invalidateThreadQueries,
} from "../query-invalidation";

export function useCreateThread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: v2.ThreadStartParams = {}) => {
      const response = await requestAppServerMethod("thread/start", params);
      return response.response;
    },
    onSuccess: () => invalidateThreadList(queryClient),
  });
}

export function useArchiveThread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: v2.ThreadArchiveParams) => {
      const response = await requestAppServerMethod("thread/archive", params);
      return response.response;
    },
    onSuccess: () => invalidateThreadList(queryClient),
  });
}

export function useUnarchiveThread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: v2.ThreadUnarchiveParams) => {
      const response = await requestAppServerMethod("thread/unarchive", params);
      return response.response;
    },
    onSuccess: () => invalidateThreadList(queryClient),
  });
}

export function useRenameThread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: v2.ThreadSetNameParams) => {
      const response = await requestAppServerMethod("thread/name/set", params);
      return response.response;
    },
    onSuccess: (_response, params) => {
      invalidateThreadQueries(queryClient, params.threadId);
    },
  });
}

export function useResumeThread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: v2.ThreadResumeParams) => {
      const response = await requestAppServerMethod("thread/resume", params);
      return response.response;
    },
    onSuccess: (_response, params) => {
      invalidateThreadQueries(queryClient, params.threadId);
    },
  });
}

export function useRevertThread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: v2.ThreadRevertParams) => {
      await requestAppServerMethod("thread/resume", {
        threadId: params.threadId,
        excludeTurns: true,
      });
      const response = await requestAppServerMethod("thread/revert", params);
      return response.response;
    },
    onSuccess: (_response, params) =>
      invalidateThreadQueries(queryClient, params.threadId),
  });
}

export function useForkThread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: v2.ThreadForkParams) => {
      const response = await requestAppServerMethod("thread/fork", params);
      return response.response;
    },
    onSuccess: () => invalidateThreadList(queryClient),
  });
}

export function useSetThreadGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: v2.ThreadGoalSetParams) => {
      const response = await requestAppServerMethod("thread/goal/set", params);
      return response.response;
    },
    onSuccess: (_response, params) =>
      invalidateThreadQueries(queryClient, params.threadId),
  });
}

export function useClearThreadGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: v2.ThreadGoalClearParams) => {
      const response = await requestAppServerMethod(
        "thread/goal/clear",
        params,
      );
      return response.response;
    },
    onSuccess: (_response, params) =>
      invalidateThreadQueries(queryClient, params.threadId),
  });
}

export function useAddThreadAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: v2.ThreadAttachmentAddParams) => {
      const response = await requestAppServerMethod(
        "thread/attachment/add",
        params,
      );
      return response.response;
    },
    onSuccess: (_response, params) =>
      invalidateThreadQueries(queryClient, params.threadId),
  });
}

export function useRemoveThreadAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: v2.ThreadAttachmentRemoveParams) => {
      const response = await requestAppServerMethod(
        "thread/attachment/remove",
        params,
      );
      return response.response;
    },
    onSuccess: (_response, params) =>
      invalidateThreadQueries(queryClient, params.threadId),
  });
}

export function useUpdateThreadSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: v2.ThreadSettingsUpdateParams) => {
      const response = await requestAppServerMethod(
        "thread/settings/update",
        params,
      );
      return response.response;
    },
    onSuccess: (_response, params) =>
      invalidateThreadQueries(queryClient, params.threadId),
  });
}

export function useUpdateThreadQueue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: v2.ThreadQueueUpdateParams) => {
      const response = await requestAppServerMethod(
        "thread/queue/update",
        params,
      );
      return response.response;
    },
    onSuccess: (_response, params) =>
      invalidateThreadQueries(queryClient, params.threadId),
  });
}

export function useDeleteThreadQueueItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: v2.ThreadQueueDeleteParams) => {
      const response = await requestAppServerMethod(
        "thread/queue/delete",
        params,
      );
      return response.response;
    },
    onSuccess: (_response, params) =>
      invalidateThreadQueries(queryClient, params.threadId),
  });
}

export function useReorderThreadQueue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: v2.ThreadQueueReorderParams) => {
      const response = await requestAppServerMethod(
        "thread/queue/reorder",
        params,
      );
      return response.response;
    },
    onSuccess: (_response, params) =>
      invalidateThreadQueries(queryClient, params.threadId),
  });
}

export function useStartThreadQueue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: v2.ThreadQueueStartParams) => {
      const response = await requestAppServerMethod(
        "thread/queue/start",
        params,
      );
      return response.response;
    },
    onSuccess: (_response, params) =>
      invalidateThreadQueries(queryClient, params.threadId),
  });
}
