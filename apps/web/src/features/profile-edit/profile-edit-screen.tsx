"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";

import {
  avatarCropRectangle,
  playerDisplayNameSchema,
  type PrivatePlayer,
} from "@football/contracts";
import { Button } from "@football/ui";

import { ConfirmDialog } from "@/components/confirm-dialog/confirm-dialog";
import { mediaContentUrl } from "@/lib/api/client";
import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";
import { refreshPlayerIdentityProjections } from "@/lib/api/player-projection-cache";
import { SettingsFrame } from "@/features/profile-settings/settings-visual";

import styles from "./profile-edit.module.css";

export function ProfileEditScreen() {
  const player = useQuery({ queryKey: queryKeys.me, queryFn: api.me });

  if (player.isPending)
    return (
      <div className={styles.page} role="status">
        Cargando tu identidad…
      </div>
    );
  if (player.isError)
    return (
      <div className={styles.page} role="alert">
        No pudimos cargar tu identidad deportiva.
      </div>
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
    <SettingsFrame
      active="profile"
      description="Definí cómo aparece tu identidad deportiva en FIFAR."
      eyebrow="PERFIL"
      title="Editar identidad"
    >
      <div className={styles.page}>
        <section className={styles.module} aria-labelledby="display-name-title">
          <header className={styles.moduleHeader}>
            <span>IDENTIDAD DEPORTIVA</span>
            <h2 id="display-name-title">Tu nombre en cancha</h2>
            <p>
              Se muestra en rankings, búsqueda y tu ficha. No modifica el nombre
              ni el email de tu cuenta.
            </p>
          </header>
          <form className={styles.form} onSubmit={submit}>
            <label className={styles.field}>
              <span>Nombre deportivo</span>
              <input
                autoComplete="nickname"
                maxLength={40}
                minLength={2}
                onChange={(event) => setDisplayName(event.target.value)}
                required
                value={displayName}
              />
              <small>Entre 2 y 40 caracteres. No necesita ser único.</small>
            </label>

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
              <Link
                className="ui-button ui-button--secondary"
                href="/profile/settings"
              >
                Volver
              </Link>
            </div>
          </form>
        </section>

        <PrivacyEditor player={player} />
        <AvatarEditor player={player} />
      </div>
    </SettingsFrame>
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
        queryClient.invalidateQueries({ queryKey: queryKeys.personalHome }),
        queryClient.invalidateQueries({ queryKey: queryKeys.ownProfile }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.publicPlayerProfile(player.id),
        }),
      ]);
    },
  });
  return (
    <section className={styles.module}>
      <header className={styles.moduleHeader}>
        <span>VISIBILIDAD</span>
        <h2>Perfil deportivo</h2>
        <p>
          Público aparece en búsqueda, rankings globales y discovery
          autenticado. Privado conserva tu evidencia dentro de grupos y partidos
          compartidos.
        </p>
      </header>
      <div
        className={styles.privacyControl}
        aria-label="Visibilidad del perfil"
      >
        <Button
          aria-pressed={player.profileVisibility === "PUBLIC"}
          disabled={privacy.isPending || player.profileVisibility === "PUBLIC"}
          onClick={() => privacy.mutate({ profileVisibility: "PUBLIC" })}
          variant="management"
        >
          Público
        </Button>
        <Button
          aria-pressed={player.profileVisibility === "PRIVATE"}
          disabled={privacy.isPending || player.profileVisibility === "PRIVATE"}
          onClick={() => privacy.mutate({ profileVisibility: "PRIVATE" })}
          variant="management"
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
  const [imageSize, setImageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
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
    setImageSize(null);
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
    <section className={styles.module} aria-labelledby="avatar-title">
      <header className={styles.moduleHeader}>
        <span>FOTO DEL JUGADOR</span>
        <h2 id="avatar-title">Tu imagen en la Card</h2>
        <p>
          Se publica en tu ficha deportiva autenticada. Guardamos únicamente una
          versión WebP saneada, sin EXIF ni ubicación.
        </p>
      </header>

      <div className={styles.avatarWorkspace}>
        <div className={styles.cropPreview}>
          {visibleUrl ? (
            // This is a local preview or the authenticated media endpoint.
            <img
              alt="Vista previa del encuadre"
              onLoad={(event) => {
                if (previewUrl)
                  setImageSize({
                    width: event.currentTarget.naturalWidth,
                    height: event.currentTarget.naturalHeight,
                  });
              }}
              src={visibleUrl}
              style={
                previewUrl && imageSize
                  ? avatarPreviewStyle(imageSize, { cropX, cropY, zoom })
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

function avatarPreviewStyle(
  image: { width: number; height: number },
  crop: { cropX: number; cropY: number; zoom: number },
) {
  const rectangle = avatarCropRectangle(image.width, image.height, crop);
  return {
    position: "absolute" as const,
    inlineSize: `${(image.width / rectangle.width) * 100}%`,
    blockSize: `${(image.height / rectangle.height) * 100}%`,
    maxInlineSize: "none",
    insetInlineStart: `${(-rectangle.left / rectangle.width) * 100}%`,
    insetBlockStart: `${(-rectangle.top / rectangle.height) * 100}%`,
    objectFit: "fill" as const,
  };
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
