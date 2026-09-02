"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";

import {
  playerDisplayNameSchema,
  type PrivatePlayer,
} from "@football/contracts";
import { Button, Text } from "@football/ui";

import { ConfirmDialog } from "@/components/confirm-dialog/confirm-dialog";
import { mediaContentUrl } from "@/lib/api/client";
import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";
import { refreshPlayerIdentityProjections } from "@/lib/api/player-projection-cache";

import styles from "./profile-edit.module.css";

export function ProfileEditScreen() {
  const player = useQuery({ queryKey: queryKeys.me, queryFn: api.me });

  if (player.isPending)
    return (
      <main className={styles.page} role="status">
        Cargando tu identidad…
      </main>
    );
  if (player.isError)
    return (
      <main className={styles.page} role="alert">
        No pudimos cargar tu identidad deportiva.
      </main>
    );

  return <ProfileEditForm key={player.data.id} player={player.data} />;
}

function ProfileEditForm({ player }: Readonly<{ player: PrivatePlayer }>) {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(player.displayName);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const update = useMutation({
    mutationFn: api.updatePlayer,
    onSuccess: async (updated) => {
      setDisplayName(updated.displayName);
      setFeedback("Tu identidad deportiva quedó actualizada.");
      await refreshPlayerIdentityProjections(queryClient, updated);
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (update.isPending) return;
    setFeedback(null);
    setValidationError(null);
    const parsed = playerDisplayNameSchema.safeParse(displayName);
    if (!parsed.success) {
      setValidationError(displayNameMessage(parsed.error.issues[0]?.message));
      return;
    }
    update.mutate({ displayName: parsed.data });
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Text as="span" tone="accent" variant="label">
          Perfil privado
        </Text>
        <Text as="h1" variant="display-lg">
          Editar identidad
        </Text>
        <Text tone="muted">
          Tu nombre deportivo se muestra en rankings, búsqueda y tu ficha de
          jugador. No modifica el nombre ni el email de tu cuenta.
        </Text>
      </header>

      <form className={styles.form} onSubmit={submit}>
        <label className={styles.field}>
          Nombre deportivo
          <input
            autoComplete="nickname"
            maxLength={40}
            minLength={2}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            value={displayName}
          />
        </label>
        <Text tone="muted">
          Entre 2 y 40 caracteres. No necesita ser único.
        </Text>

        {validationError && (
          <p className={styles.error} role="alert">
            {validationError}
          </p>
        )}
        {update.isError && (
          <p className={styles.error} role="alert">
            {update.error.message}
          </p>
        )}
        {feedback && (
          <p className={styles.feedback} role="status">
            {feedback}
          </p>
        )}

        <div className={styles.actions}>
          <Button disabled={update.isPending} type="submit">
            {update.isPending ? "Guardando…" : "Guardar perfil"}
          </Button>
          <Link className="ui-button ui-button--secondary" href="/profile">
            Volver al perfil
          </Link>
        </div>
      </form>

      <PrivacyEditor player={player} />

      <AvatarEditor player={player} />
    </main>
  );
}

function PrivacyEditor({ player }: Readonly<{ player: PrivatePlayer }>) {
  const queryClient = useQueryClient();
  const privacy = useMutation({
    mutationFn: api.updatePlayerPrivacy,
    onSuccess: async (result) => {
      queryClient.setQueryData(queryKeys.me, {
        ...player,
        profileVisibility: result.profileVisibility,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["rankings"] }),
        queryClient.invalidateQueries({ queryKey: ["discovery"] }),
        queryClient.invalidateQueries({ queryKey: ["search"] }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.publicPlayerProfile(player.id),
        }),
      ]);
    },
  });
  return (
    <section className={styles.avatarSection}>
      <div>
        <Text tone="accent" variant="label">
          VISIBILIDAD
        </Text>
        <Text as="h2" variant="heading-lg">
          Perfil deportivo
        </Text>
        <Text tone="muted">
          Público aparece en búsqueda, rankings globales y discovery
          autenticado. Privado conserva tu evidencia dentro de grupos y partidos
          compartidos.
        </Text>
      </div>
      <div className={styles.actions}>
        <Button
          disabled={privacy.isPending || player.profileVisibility === "PUBLIC"}
          onClick={() => privacy.mutate({ profileVisibility: "PUBLIC" })}
        >
          Público
        </Button>
        <Button
          disabled={privacy.isPending || player.profileVisibility === "PRIVATE"}
          onClick={() => privacy.mutate({ profileVisibility: "PRIVATE" })}
          variant="secondary"
        >
          Privado
        </Button>
      </div>
      {privacy.isError ? (
        <p className={styles.error}>{privacy.error.message}</p>
      ) : null}
    </section>
  );
}

function AvatarEditor({ player }: Readonly<{ player: PrivatePlayer }>) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cropX, setCropX] = useState(0.5);
  const [cropY, setCropY] = useState(0.5);
  const [zoom, setZoom] = useState(1);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const upload = useMutation({
    mutationFn: api.uploadAvatar,
    onSuccess: async (image) => {
      setFile(null);
      setPreviewUrl(null);
      setFeedback("Tu foto deportiva quedó actualizada.");
      await refreshPlayerIdentityProjections(queryClient, { ...player, image });
    },
  });
  const remove = useMutation({
    mutationFn: api.removeAvatar,
    onSuccess: async () => {
      setConfirmRemove(false);
      setFeedback("Tu foto fue eliminada. La Card volvió al diseño base.");
      await refreshPlayerIdentityProjections(queryClient, {
        ...player,
        image: null,
      });
    },
  });

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setFeedback(null);
    setValidationError(null);
    if (!selected) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type)) {
      setValidationError("Usá una imagen JPEG, PNG o WebP.");
      return;
    }
    if (selected.size > 8 * 1024 * 1024) {
      setValidationError("La foto puede pesar hasta 8 MB.");
      return;
    }
    setFile(selected);
    setCropX(0.5);
    setCropY(0.5);
    setZoom(1);
    setPreviewUrl(URL.createObjectURL(selected));
  }

  function saveAvatar() {
    if (!file || upload.isPending) return;
    const form = new FormData();
    form.append("cropX", String(cropX));
    form.append("cropY", String(cropY));
    form.append("zoom", String(zoom));
    form.append("avatar", file);
    upload.mutate(form);
  }

  const currentUrl = player.image ? mediaContentUrl(player.image.url) : null;
  const visibleUrl = previewUrl ?? currentUrl;

  return (
    <section className={styles.avatarSection} aria-labelledby="avatar-title">
      <div>
        <Text as="span" tone="accent" variant="label">
          Foto del jugador
        </Text>
        <Text as="h2" id="avatar-title" variant="heading-lg">
          Tu imagen en la Card
        </Text>
        <Text tone="muted">
          Se publica en tu ficha deportiva autenticada. Guardamos únicamente una
          versión WebP saneada, sin EXIF ni ubicación.
        </Text>
      </div>

      <div className={styles.avatarWorkspace}>
        <div className={styles.cropPreview}>
          {visibleUrl ? (
            // This is a local preview or the authenticated media endpoint.
            <img
              alt="Vista previa del encuadre"
              src={visibleUrl}
              style={
                previewUrl
                  ? {
                      objectPosition: `${cropX * 100}% ${cropY * 100}%`,
                      transform: `scale(${zoom})`,
                      transformOrigin: `${cropX * 100}% ${cropY * 100}%`,
                    }
                  : undefined
              }
            />
          ) : (
            <div className={styles.avatarFallback} aria-label="Sin foto">
              <span />
            </div>
          )}
        </div>

        <div className={styles.avatarControls}>
          <label className={styles.fileControl}>
            Seleccionar foto
            <input
              accept="image/jpeg,image/png,image/webp"
              onChange={selectFile}
              type="file"
            />
          </label>
          {file && (
            <>
              <RangeControl
                label="Encuadre horizontal"
                onChange={setCropX}
                value={cropX}
              />
              <RangeControl
                label="Encuadre vertical"
                onChange={setCropY}
                value={cropY}
              />
              <RangeControl
                label="Zoom"
                maximum={3}
                minimum={1}
                onChange={setZoom}
                step={0.05}
                value={zoom}
              />
            </>
          )}
        </div>
      </div>

      {validationError && (
        <p className={styles.error} role="alert">
          {validationError}
        </p>
      )}
      {upload.isError && (
        <p className={styles.error} role="alert">
          {upload.error.message}
        </p>
      )}
      {remove.isError && (
        <p className={styles.error} role="alert">
          {remove.error.message}
        </p>
      )}
      {feedback && (
        <p className={styles.feedback} role="status">
          {feedback}
        </p>
      )}

      <div className={styles.actions}>
        {file && (
          <Button disabled={upload.isPending} onClick={saveAvatar}>
            {upload.isPending ? "Procesando…" : "Guardar foto"}
          </Button>
        )}
        {file && (
          <Button
            onClick={() => {
              setFile(null);
              setPreviewUrl(null);
            }}
            variant="secondary"
          >
            Cancelar selección
          </Button>
        )}
        {player.image && !file && (
          <Button onClick={() => setConfirmRemove(true)} variant="quiet">
            Eliminar foto
          </Button>
        )}
      </div>

      <ConfirmDialog
        confirmDisabled={remove.isPending}
        confirmLabel={remove.isPending ? "Eliminando…" : "Eliminar foto"}
        message="La Card volverá a mostrar la silueta base. Tu identidad y rendimiento no cambian."
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => remove.mutate()}
        open={confirmRemove}
        title="¿Eliminar tu foto deportiva?"
      />
    </section>
  );
}

function RangeControl({
  label,
  value,
  onChange,
  minimum = 0,
  maximum = 1,
  step = 0.01,
}: Readonly<{
  label: string;
  value: number;
  onChange: (value: number) => void;
  minimum?: number;
  maximum?: number;
  step?: number;
}>) {
  return (
    <label className={styles.rangeControl}>
      {label}
      <input
        max={maximum}
        min={minimum}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="range"
        value={value}
      />
    </label>
  );
}

function displayNameMessage(message?: string) {
  if (message?.includes("control"))
    return "El nombre no puede contener saltos de línea ni caracteres de control.";
  if (message?.includes("at least"))
    return "Usá al menos 2 caracteres para tu nombre deportivo.";
  if (message?.includes("at most"))
    return "El nombre deportivo puede tener hasta 40 caracteres.";
  return "Revisá el nombre deportivo ingresado.";
}
