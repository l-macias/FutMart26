"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

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
import { avatarCropAfterDrag, type AvatarCrop } from "./avatar-crop-model";
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
  const fileInput = useRef<HTMLInputElement>(null);
  const drag = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
  } | null>(null);
  const editor = useQuery({
    queryKey: queryKeys.avatarEditor,
    queryFn: api.avatarEditorState,
  });
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editingExisting, setEditingExisting] = useState(false);
  const [crop, setCrop] = useState<AvatarCrop>({
    cropX: 0.5,
    cropY: 0.5,
    zoom: 1,
  });
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

  async function refreshAvatar(image: PrivatePlayer["image"]) {
    await Promise.all([
      refreshPlayerIdentityProjections(queryClient, { ...player, image }),
      queryClient.invalidateQueries({ queryKey: queryKeys.avatarEditor }),
    ]);
  }

  const upload = useMutation({
    mutationFn: api.uploadAvatar,
    onSuccess: async (image) => {
      setFile(null);
      setPreviewUrl(null);
      setEditingExisting(false);
      setImageSize(null);
      setFeedback("Tu foto deportiva quedó actualizada.");
      await refreshAvatar(image);
    },
  });
  const reframe = useMutation({
    mutationFn: api.reframeAvatar,
    onSuccess: async (image) => {
      setEditingExisting(false);
      setImageSize(null);
      setFeedback("El encuadre de tu Card quedó actualizado.");
      await refreshAvatar(image);
    },
  });
  const remove = useMutation({
    mutationFn: api.removeAvatar,
    onSuccess: async () => {
      setConfirmRemove(false);
      setEditingExisting(false);
      setFeedback("Tu foto fue eliminada. La Card volvió al diseño base.");
      await refreshAvatar(null);
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
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(selected);
    setEditingExisting(false);
    setCrop({ cropX: 0.5, cropY: 0.5, zoom: 1 });
    setImageSize(null);
    setPreviewUrl(URL.createObjectURL(selected));
  }

  function beginExistingEdit() {
    if (editor.data?.status === "EDITABLE") {
      setFeedback(null);
      setValidationError(null);
      setCrop(editor.data.crop);
      setImageSize({
        width: editor.data.source.width,
        height: editor.data.source.height,
      });
      setEditingExisting(true);
      return;
    }
    setFeedback(
      "Este avatar es anterior al editor. Seleccioná la foto una vez más para habilitar futuros ajustes.",
    );
    fileInput.current?.click();
  }

  function saveAvatar() {
    if (upload.isPending || reframe.isPending) return;
    if (file) {
      const form = new FormData();
      form.append("cropX", String(crop.cropX));
      form.append("cropY", String(crop.cropY));
      form.append("zoom", String(crop.zoom));
      form.append("avatar", file);
      upload.mutate(form);
      return;
    }
    if (editingExisting && editor.data?.status === "EDITABLE")
      reframe.mutate({
        ...crop,
        expectedRevision: editor.data.revision,
      });
  }

  const isEditing = Boolean(file) || editingExisting;
  const currentUrl = player.image ? mediaContentUrl(player.image.url) : null;
  const sourceUrl =
    editingExisting && editor.data?.status === "EDITABLE"
      ? mediaContentUrl(editor.data.source.url)
      : null;
  const visibleUrl = previewUrl ?? sourceUrl ?? currentUrl;

  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!isEditing || !imageSize) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
    };
    event.preventDefault();
  }

  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const previous = drag.current;
    if (!previous || previous.pointerId !== event.pointerId || !imageSize)
      return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setCrop((current) =>
      avatarCropAfterDrag(imageSize, current, {
        deltaX: event.clientX - previous.clientX,
        deltaY: event.clientY - previous.clientY,
        viewportWidth: bounds.width,
        viewportHeight: bounds.height,
      }),
    );
    drag.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
    };
    event.preventDefault();
  }

  function pointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    drag.current = null;
  }

  return (
    <section className={styles.module} aria-labelledby="avatar-title">
      <header className={styles.moduleHeader}>
        <span>FOTO DEL JUGADOR</span>
        <h2 id="avatar-title">Tu imagen en la Card</h2>
        <p>
          Conservamos una fuente WebP saneada y privada para que puedas ajustar
          el encuadre sin perder calidad. Nunca guardamos EXIF ni ubicación.
        </p>
      </header>

      <div className={styles.avatarWorkspace}>
        <div
          aria-label={
            isEditing
              ? "Vista previa editable del encuadre en la Card"
              : "Vista previa del encuadre en la Card"
          }
          className={styles.cropPreview}
          data-editing={isEditing}
          onPointerCancel={pointerEnd}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerEnd}
        >
          {visibleUrl ? (
            <img
              alt="Vista previa del encuadre"
              draggable={false}
              onLoad={(event) => {
                if (isEditing)
                  setImageSize({
                    width: event.currentTarget.naturalWidth,
                    height: event.currentTarget.naturalHeight,
                  });
              }}
              src={visibleUrl}
              style={
                isEditing && imageSize
                  ? avatarPreviewStyle(imageSize, crop)
                  : undefined
              }
            />
          ) : (
            <div className={styles.avatarFallback} aria-label="Sin foto">
              <span />
            </div>
          )}
          {isEditing ? (
            <span className={styles.dragHint}>Arrastrá para encuadrar</span>
          ) : null}
        </div>

        <div className={styles.avatarControls}>
          <label className={styles.fileControl}>
            {player.image ? "Seleccionar otra foto" : "Seleccionar foto"}
            <input
              accept="image/jpeg,image/png,image/webp"
              onChange={selectFile}
              ref={fileInput}
              type="file"
            />
          </label>
          {isEditing ? (
            <>
              <RangeControl
                label="Encuadre horizontal"
                onChange={(cropX) =>
                  setCrop((current) => ({ ...current, cropX }))
                }
                value={crop.cropX}
              />
              <RangeControl
                label="Encuadre vertical"
                onChange={(cropY) =>
                  setCrop((current) => ({ ...current, cropY }))
                }
                value={crop.cropY}
              />
              <RangeControl
                label="Zoom"
                maximum={3}
                minimum={1}
                onChange={(zoom) =>
                  setCrop((current) => ({ ...current, zoom }))
                }
                step={0.05}
                value={crop.zoom}
              />
            </>
          ) : null}
          {player.image && !isEditing ? (
            <Button
              disabled={editor.isPending}
              onClick={beginExistingEdit}
              variant="secondary"
            >
              Editar encuadre
            </Button>
          ) : null}
          {editor.data?.status === "LEGACY" && !isEditing ? (
            <p className={styles.legacyNotice}>
              Para editar este avatar anterior, seleccioná nuevamente la foto
              una sola vez.
            </p>
          ) : null}
        </div>
      </div>

      {validationError ? (
        <p className={styles.error} role="alert">
          {validationError}
        </p>
      ) : null}
      {editor.isError ? (
        <p className={styles.error} role="alert">
          No pudimos cargar el editor de foto.
        </p>
      ) : null}
      {upload.isError || reframe.isError || remove.isError ? (
        <p className={styles.error} role="alert">
          {(upload.error ?? reframe.error ?? remove.error)?.message}
        </p>
      ) : null}
      {feedback ? (
        <p className={styles.feedback} role="status">
          {feedback}
        </p>
      ) : null}

      <div className={styles.actions}>
        {isEditing ? (
          <Button
            disabled={upload.isPending || reframe.isPending}
            onClick={saveAvatar}
          >
            {upload.isPending || reframe.isPending
              ? "Procesando…"
              : file
                ? "Guardar foto"
                : "Guardar encuadre"}
          </Button>
        ) : null}
        {isEditing ? (
          <Button
            onClick={() => {
              setFile(null);
              setPreviewUrl(null);
              setEditingExisting(false);
              setImageSize(null);
            }}
            variant="secondary"
          >
            {file ? "Cancelar selección" : "Cancelar"}
          </Button>
        ) : null}
        {player.image && !isEditing ? (
          <Button onClick={() => setConfirmRemove(true)} variant="quiet">
            Eliminar foto
          </Button>
        ) : null}
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
  crop: AvatarCrop,
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
