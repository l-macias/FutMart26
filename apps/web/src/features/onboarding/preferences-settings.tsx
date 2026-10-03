"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";
import { SettingsFrame } from "@/features/profile-settings/settings-visual";
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
    <SettingsFrame
      active="football"
      description="Ajustá cómo jugás y qué señales ayudan a armar los equipos."
      eyebrow="FÚTBOL F5"
      title="Preferencias de juego"
    >
      <FootballOnboarding
        playerName={player.data.displayName}
        initial={preferences.data}
      />
    </SettingsFrame>
  );
}
