"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";
import { FootballOnboarding } from "./football-onboarding";

export function PreferencesSettings() {
  const player = useQuery({ queryKey: queryKeys.me, queryFn: api.me });
  const preferences = useQuery({
    queryKey: queryKeys.footballPreferences,
    queryFn: api.preferences,
  });
  if (player.isPending || preferences.isPending)
    return <p role="status">Cargando preferencias…</p>;
  if (player.isError || preferences.isError)
    return <p role="alert">No pudimos cargar tus preferencias.</p>;
  return (
    <FootballOnboarding
      playerName={player.data.displayName}
      initial={preferences.data}
    />
  );
}
