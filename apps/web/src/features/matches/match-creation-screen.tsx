"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button, Text } from "@football/ui";
import { ARGENTINA_COUNTRY, ARGENTINA_PROVINCES } from "@football/contracts";

import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";

import styles from "./matches.module.css";

export function MatchCreationScreen({
  groupId,
}: Readonly<{ groupId: string }>) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const defaults = useQuery({
    queryKey: queryKeys.matchDefaults(groupId),
    queryFn: () => api.matchDefaults(groupId),
  });
  const [step, setStep] = useState<"EDIT" | "REVIEW">("EDIT");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("20:00");
  const [duration, setDuration] = useState(60);
  const [capacityInput, setCapacityInput] = useState("10");
  const capacity = capacityInput === "" ? null : Number(capacityInput);
  const validCapacity =
    capacity !== null && Number.isInteger(capacity) && capacity >= 1;
  const [locationQuery, setLocationQuery] = useState("");
  const [venue, setVenue] = useState<
    Awaited<ReturnType<typeof api.searchVenues>>[number] | null
  >(null);
  const [courtId, setCourtId] = useState<string | null>(null);
  const [saveDefaults, setSaveDefaults] = useState(false);
  const [showVenueForm, setShowVenueForm] = useState(false);
  const [courtName, setCourtName] = useState("");

  useEffect(() => {
    if (!defaults.data) return;
    setTime(defaults.data.defaultStartTime ?? "20:00");
    setDuration(defaults.data.defaultDurationMinutes);
    setCapacityInput(String(defaults.data.defaultCapacity));
    setLocationQuery(
      defaults.data.defaultVenue?.displayName ??
        defaults.data.defaultLocationText ??
        "",
    );
    setVenue(defaults.data.defaultVenue);
    setCourtId(defaults.data.defaultCourt?.id ?? null);
  }, [defaults.data]);

  const venues = useQuery({
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
  const selectedCourt =
    courts.data?.find((court) => court.id === courtId) ?? null;
  const scheduledAt = useMemo(
    () => (date && time ? new Date(`${date}T${time}`).toISOString() : null),
    [date, time],
  );
  const create = useMutation({
    mutationFn: () =>
      api.createMatch(groupId, {
        discipline: "F5",
        scheduledAt: scheduledAt!,
        durationMinutes: duration,
        capacity: capacity!,
        locationText: venue ? venue.displayName : locationQuery,
        venueId: venue?.id ?? null,
        courtId,
        saveAsDefaults: saveDefaults,
        defaultStartTime: time,
      }),
    onSuccess: async (match) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.matches(groupId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.personalMatchesRoot,
      });
      if (saveDefaults)
        await queryClient.invalidateQueries({
          queryKey: queryKeys.matchDefaults(groupId),
        });
      router.push(`/play/matches/${match.id}`);
    },
  });
  const createVenue = useMutation({
    mutationFn: (form: FormData) =>
      api.createVenue(groupId, {
        displayName: formText(form, "displayName"),
        city: formText(form, "city"),
        address: formText(form, "address") || null,
        countryCode: formText(form, "countryCode"),
        provinceCode: formText(form, "provinceCode"),
      }),
    onSuccess: (created) => {
      setVenue(created);
      setLocationQuery(created.displayName);
      setShowVenueForm(false);
    },
  });
  const createCourt = useMutation({
    mutationFn: () => api.createCourt(groupId, venue!.id, courtName),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.courts(created.venueId),
      });
      setCourtId(created.id);
      setCourtName("");
    },
  });

  if (defaults.isPending)
    return (
      <main className={styles.page}>
        <p role="status">Preparando el próximo partido…</p>
      </main>
    );
  if (defaults.isError)
    return (
      <main className={styles.page}>
        <p className={styles.error} role="alert">
          {defaults.error.message}
        </p>
      </main>
    );

  if (step === "REVIEW")
    return (
      <main className={styles.page}>
        <Link className={styles.back} href={`/groups/${groupId}`}>
          ← GRUPO
        </Link>
        <Text tone="accent" variant="label">
          DRAFT · REVISIÓN
        </Text>
        <Text as="h1" variant="display-lg">
          Próximo partido.
        </Text>
        <section className={styles.review}>
          <Review label="DISCIPLINA" value="F5" />
          <Review
            label="FECHA Y HORA"
            value={new Intl.DateTimeFormat("es-AR", {
              dateStyle: "full",
              timeStyle: "short",
            }).format(new Date(scheduledAt!))}
          />
          <Review label="DURACIÓN" value={`${duration} MIN`} />
          <Review
            label="CUPO DE JUGADORES"
            value={`${capacity} · hasta ${Math.ceil(capacity! / 2)} vs ${Math.floor(capacity! / 2)}`}
          />
          <Review
            label="UBICACIÓN"
            value={[
              venue?.displayName ?? locationQuery,
              selectedCourt?.displayName,
              venue?.city,
            ]
              .filter(Boolean)
              .join(" · ")}
          />
        </section>
        <p className={styles.muted}>
          Se guardará como Draft. Podrás revisar o editar estos datos y publicar
          la convocatoria desde el detalle del partido.
        </p>
        {create.isError && (
          <p className={styles.error} role="alert">
            {create.error.message}
          </p>
        )}
        <div className={styles.actions}>
          <Button onClick={() => setStep("EDIT")} variant="secondary">
            Editar
          </Button>
          <Button disabled={create.isPending} onClick={() => create.mutate()}>
            Crear Draft
          </Button>
        </div>
      </main>
    );

  return (
    <main className={styles.page}>
      <Link className={styles.back} href={`/groups/${groupId}`}>
        ← GRUPO
      </Link>
      <Text tone="accent" variant="label">
        F5 · NUEVA CONVOCATORIA
      </Text>
      <Text as="h1" variant="display-lg">
        Crear próximo partido.
      </Text>
      <div className={styles.formGrid}>
        <section className={styles.formSection}>
          <Text as="h2" variant="heading-lg">
            Cuándo y cuánto.
          </Text>
          <label>
            <span>Fecha</span>
            <input
              min={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setDate(event.target.value)}
              required
              type="date"
              value={date}
            />
          </label>
          <label>
            <span>Hora</span>
            <input
              onChange={(event) => setTime(event.target.value)}
              required
              type="time"
              value={time}
            />
          </label>
          <fieldset>
            <legend>Duración</legend>
            <div className={styles.options}>
              {[60, 75, 90, 120].map((value) => (
                <button
                  aria-pressed={duration === value}
                  key={value}
                  onClick={() => setDuration(value)}
                  type="button"
                >
                  {value} MIN
                </button>
              ))}
            </div>
          </fieldset>
          <label>
            <span>Cupo de jugadores</span>
            <input
              min="1"
              onChange={(event) => setCapacityInput(event.target.value)}
              type="number"
              value={capacityInput}
            />
            <small>
              {validCapacity
                ? `F5 · hasta ${Math.ceil(capacity / 2)} vs ${Math.floor(capacity / 2)}`
                : "F5 · hasta — vs —"}
            </small>
          </label>
        </section>
        <section className={styles.formSection}>
          <Text as="h2" variant="heading-lg">
            Dónde jugamos.
          </Text>
          <label>
            <span>Buscar sede o escribir ubicación</span>
            <input
              autoComplete="off"
              onChange={(event) => {
                setVenue(null);
                setCourtId(null);
                setLocationQuery(event.target.value);
              }}
              value={locationQuery}
            />
          </label>
          {!venue && venues.data && (
            <div className={styles.suggestions}>
              {venues.data.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setVenue(item);
                    setLocationQuery(item.displayName);
                  }}
                  type="button"
                >
                  <strong>{item.displayName}</strong>
                  <small>
                    {item.city}
                    {item.address ? ` · ${item.address}` : ""}
                  </small>
                </button>
              ))}
              <small className={styles.manualLocationHint}>
                Si no elegís una sede, “{locationQuery}” se guardará como
                ubicación manual.
              </small>
            </div>
          )}
          <Button
            onClick={() => setShowVenueForm((value) => !value)}
            variant="quiet"
          >
            Registrar nueva sede
          </Button>
          {showVenueForm && (
            <form
              action={(data) => createVenue.mutate(data)}
              className={styles.inlineForm}
            >
              <label>
                <span>Nombre</span>
                <input name="displayName" required />
              </label>
              <label>
                <span>Ciudad</span>
                <input name="city" required />
              </label>
              <label>
                <span>País</span>
                <select
                  defaultValue={ARGENTINA_COUNTRY.code}
                  name="countryCode"
                  required
                >
                  <option value={ARGENTINA_COUNTRY.code}>
                    {ARGENTINA_COUNTRY.displayName}
                  </option>
                </select>
              </label>
              <label>
                <span>Provincia</span>
                <select defaultValue="" name="provinceCode" required>
                  <option disabled value="">
                    Seleccionar provincia
                  </option>
                  {ARGENTINA_PROVINCES.map((province) => (
                    <option key={province.code} value={province.code}>
                      {province.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Dirección</span>
                <input name="address" />
              </label>
              {createVenue.isError && (
                <p className={styles.error}>{createVenue.error.message}</p>
              )}
              <Button disabled={createVenue.isPending} type="submit">
                Crear y seleccionar
              </Button>
            </form>
          )}
          {venue && (
            <div className={styles.selected}>
              <strong>{venue.displayName}</strong>
              <small>{venue.city}</small>
              <label>
                <span>Cancha · opcional</span>
                <select
                  onChange={(event) => setCourtId(event.target.value || null)}
                  value={courtId ?? ""}
                >
                  <option value="">Sin cancha específica</option>
                  {courts.data?.map((court) => (
                    <option key={court.id} value={court.id}>
                      {court.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <div className={styles.inlineAction}>
                <input
                  aria-label="Nombre de nueva cancha"
                  onChange={(event) => setCourtName(event.target.value)}
                  placeholder="Cancha 1"
                  value={courtName}
                />
                <Button
                  disabled={!courtName.trim() || createCourt.isPending}
                  onClick={() => createCourt.mutate()}
                  variant="quiet"
                >
                  Agregar cancha
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
      <label className={styles.checkbox}>
        <input
          checked={saveDefaults}
          onChange={(event) => setSaveDefaults(event.target.checked)}
          type="checkbox"
        />{" "}
        Guardar estos valores como predeterminados
      </label>
      <div className={styles.actions}>
        <Button
          disabled={!scheduledAt || !locationQuery.trim() || !validCapacity}
          onClick={() => setStep("REVIEW")}
        >
          Revisar Draft
        </Button>
      </div>
    </main>
  );
}

function Review({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formText(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}
