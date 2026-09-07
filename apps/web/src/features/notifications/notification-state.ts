import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/api/query-keys";

export function refreshNotificationState(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.notificationUnreadCount,
    }),
    queryClient.invalidateQueries({ queryKey: queryKeys.personalHome }),
  ]);
}
