import type { QueryClient } from "@tanstack/react-query";

import type { z } from "zod";
import type { playerWithImageSchema } from "@football/contracts";

import { queryKeys } from "./query-keys";

type Player = z.infer<typeof playerWithImageSchema>;

export async function refreshPlayerIdentityProjections(
  queryClient: QueryClient,
  player: Player,
) {
  queryClient.setQueryData(queryKeys.me, player);
  await invalidate(queryClient, [
    ["players"],
    ["search"],
    ["rankings"],
    ["groups"],
    ["matches"],
    ["discovery"],
    ["me", "connections"],
    ["me", "directed-invitations"],
  ]);
}

export async function refreshFootballProfileProjections(
  queryClient: QueryClient,
) {
  await invalidate(queryClient, [
    ["players"],
    ["matches"],
    ["me", "connections"],
    ["me", "directed-invitations"],
    ["me", "recruitment"],
  ]);
}

function invalidate(queryClient: QueryClient, keys: readonly unknown[][]) {
  return Promise.all(
    keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
}
