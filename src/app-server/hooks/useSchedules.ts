import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createSchedule,
  deleteSchedule,
  listSchedules,
  runScheduleNow,
  setScheduleEnabled,
  updateSchedule,
  type ScheduleInput,
} from "../../platform/schedules";
import { appServerQueryKeys } from "../query-keys";
import { isDesktopRuntime } from "../runtime";

export function useSchedules() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: appServerQueryKeys.schedules,
    queryFn: listSchedules,
    enabled: isDesktopRuntime,
    retry: false,
  });
  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: appServerQueryKeys.schedules,
    });
  };
  const create = useMutation({
    mutationFn: createSchedule,
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: ScheduleInput }) =>
      updateSchedule(id, input),
    onSuccess: invalidate,
  });
  const setEnabled = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      setScheduleEnabled(id, enabled),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: deleteSchedule,
    onSuccess: invalidate,
  });
  const runNow = useMutation({
    mutationFn: runScheduleNow,
    onSuccess: invalidate,
  });

  return { query, create, update, setEnabled, remove, runNow };
}
