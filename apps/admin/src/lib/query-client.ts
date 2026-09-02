import { QueryClient } from "@tanstack/react-query";

import { AdminApiError } from "./api";

export function createAdminQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: true,
        retry: (count, error) =>
          error instanceof AdminApiError
            ? error.status === 0 && count < 2
            : count < 1,
      },
      mutations: { retry: false },
    },
  });
}
