"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Button, Text } from "@football/ui";

import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";

import styles from "./matches.module.css";

type Venue = NonNullable<Awaited<ReturnType<typeof api.match>>["venue"]>;

export function MatchEditScreen({ matchId }: Readonly<{ matchId: string }>) {
  const queryClient = useQueryClient();
  const match = useQuery({
    queryKey: queryKeys.match(matchId),
    queryFn: () => api.match(matchId),
  });
  const hydrated = useRef(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationInput, setDurationInput] = useState("");
  const [capacityInput, setCapacityInput] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [venue, setVenue] = useState<Venue | null>(null);
  const [courtId, setCourtId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!match.data || hydrated.current) return;
    hydrated.current = true;
    setScheduledAt(toLocalDateTimeInput(match.data.scheduledAt));
    setDurationInput(String(match.data.durationMinutes));
    setCapacityInput(String(match.data.capacity));
    setLocationQuery(match.data.venue?.displayName ?? match.data.locationText);
    setVenue(match.data.venue);
    setCourtId(match.data.courtId);
  }, [match.data]);

  const venueResults = useQuery({
    queryKey: queryKeys.venueSearch(locationQuery),
    queryFn: ({ signal }) => api.searchVenues(locationQuery, undefined, signal),
    enabled: locationQuery.trim().length >= 2 && !venue,
    staleTime: 30_000,
  });
  const courts = useQuery({
    queryKey: queryKeys.courts(venue?.id ?? "none"),
    queryFn: () => api.courts(venue!.id),
    enabled: Boolean(venue),
  });

  const duration = Number(durationInput);
  const capacity = Number(capacityInput);
  const valid =
    scheduledAt !== "" &&
    !Number.isNaN(new Date(scheduledAt).getTime()) &&
    Number.isInteger(duration) &&
    duration > 0 &&
    Number.isInteger(capacity) &&
    capacity > 0 &&
    locationQuery.trim().length > 0;

  const update = useMutation({
    mutationFn: () =>
      api.updateMatch(matchId, {
        scheduledAt: new Date(scheduledAt).toISOString(),
        durationMinutes: duration,
        capacity,
        locationText: venue ? venue.displayName : locationQuery.trim(),
        venueId: venue?.id ?? null,
        courtId: venue ? courtId : null,
      }),
    onSuccess: async () => {
      setSaved(true);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.match(matchId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.roster(matchId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.teams(matchId) }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.matches(match.data!.groupId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.recruitmentOpportunities,
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.personalMatchesRoot,
        }),
      ]);
    },
  });

  if (match.isPending)
    return (
      <main className={styles.page}>
        <p role="status">Cargando datos del partido…</p>
      </main>
    );
  if (match.isError)
    return (
      <main className={styles.page}>
        <p className={styles.error} role="alert">
          {match.error.message}
        </p>
      </main>
    );

  const editable =
    match.data.canManage &&
    (match.data.status === "DRAFT" || match.data.status === "OPEN");
  if (!editable)
    return (
      <main className={styles.page}>
        <Link className={styles.back} href={`/play/matches/${matchId}`}>
          ← PARTIDO
        </Link>
        <Text tone="accent" variant="label">
          EDICIÓN CERRADA
        </Text>
        <Text as="h1" variant="display-lg">
          Este partido ya no se puede editar.
        </Text>
        <Text tone="muted">
          Sólo un actor autorizado puede cambiar un partido en Draft u Open.
        </Text>
      </main>
    );

  return (
    <main className={styles.page}>
      <Link className={styles.back} href={`/play/matches/${matchId}`}>
        ← PARTIDO
      </Link>
      <div>
        <Text tone="accent" variant="label">
          {match.data.status} · EDITAR PARTIDO
        </Text>
        <Text as="h1" variant="display-lg">
          Ajustar convocatoria.
        </Text>
        <Text tone="muted">
          La disciplina sigue siendo F5. Cambiar fecha, hora o lugar no elimina
          inscripciones existentes.
        </Text>
      </div>

      <div className={styles.formGrid}>
        <section className={styles.formSection}>
          <Text as="h2" variant="heading-lg">
            Cuándo y cuánto.
          </Text>
          <label>
            <span>Fecha y hora</span>
            <input
              onChange={(event) => {
                setSaved(false);
                setScheduledAt(event.target.value);
              }}
              required
              type="datetime-local"
              value={scheduledAt}
            />
          </label>
          <label>
            <span>Duración en minutos</span>
            <input
              min="1"
              onChange={(event) => {
                setSaved(false);
                setDurationInput(event.target.value);
              }}
              required
              type="number"
              value={durationInput}
            />
          </label>
          <label>
            <span>Cupo de jugadores</span>
            <input
              min="1"
              onChange={(event) => {
                setSaved(false);
                setCapacityInput(event.target.value);
              }}
              required
              type="number"
              value={capacityInput}
            />
            <small>
              F5 no fija el cupo. No podés bajarlo por debajo de los
              participantes confirmados.
            </small>
          </label>
        </section>

        <section className={styles.formSection}>
          <Text as="h2" variant="heading-lg">
            Dónde jugamos.
          </Text>
          <label>
            <span>Buscar sede o escribir ubicación manual</span>
            <input
              autoComplete="off"
              onChange={(event) => {
                setSaved(false);
                setVenue(null);
                setCourtId(null);
                setLocationQuery(event.target.value);
              }}
              value={locationQuery}
            />
          </label>
          {!venue && venueResults.data && locationQuery.trim().length >= 2 && (
            <div className={styles.suggestions}>
              {venueResults.data.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setSaved(false);
                    setVenue(item);
                    setCourtId(null);
                    setLocationQuery(item.displayName);
                  }}
                  type="button"
                >
                  <strong>{item.displayName}</strong>
                  <small>{item.city}</small>
                </button>
              ))}
              <small>
                También podés guardar el texto como ubicación manual.
              </small>
            </div>
          )}
          {venue && (
            <div className={styles.selected}>
              <strong>{venue.displayName}</strong>
              <small>{venue.city}</small>
              <label>
                <span>Cancha · opcional</span>
                <select
                  onChange={(event) => {
                    setSaved(false);
                    setCourtId(event.target.value || null);
                  }}
                  value={courtId ?? ""}
                >
                  <option value="">Sin cancha específica</option>
                  {(courts.data ?? []).map((court) => (
                    <option key={court.id} value={court.id}>
                      {court.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                onClick={() => {
                  setSaved(false);
                  setVenue(null);
                  setCourtId(null);
                  setLocationQuery("");
                }}
                variant="quiet"
              >
                Usar ubicación manual
              </Button>
            </div>
          )}
        </section>
      </div>

      {saved && (
        <p className={styles.positive} role="status">
          Partido actualizado.
        </p>
      )}
      {update.isError && (
        <p className={styles.error} role="alert">
          {update.error.message}
        </p>
      )}
      <div className={styles.actions}>
        <Link
          className="ui-button ui-button--secondary"
          href={`/play/matches/${matchId}`}
        >
          Volver
        </Link>
        <Button
          disabled={!valid || update.isPending}
          onClick={() => update.mutate()}
        >
          {update.isPending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </main>
  );
}

function toLocalDateTimeInput(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
