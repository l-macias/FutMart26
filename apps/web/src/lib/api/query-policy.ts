import { QueryClient, type QueryKey } from "@tanstack/react-query";

import { ApiError } from "./client";

export const queryPolicy = {
  volatile: { staleTime: 10_000 },
  semiStable: { staleTime: 60_000 },
  stable: { staleTime: 5 * 60_000 },
} as const;

export function createWebQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 15 * 60_000,
        refetchOnWindowFocus: true,
        retry: shouldRetryQuery,
      },
      mutations: { retry: false },
    },
  });
}

function shouldRetryQuery(failureCount: number, error: unknown) {
  if (error instanceof ApiError) {
    if (error.status >= 400 && error.status < 500) return false;
    return failureCount < (error.code === "network_error" ? 2 : 1);
  }
  return failureCount < 1;
}

export function invalidateKeys(
  client: QueryClient,
  queryKeys: readonly QueryKey[],
) {
  return Promise.all(
    queryKeys.map((queryKey) => client.invalidateQueries({ queryKey })),
  );
}
