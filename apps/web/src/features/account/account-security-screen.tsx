"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Button, Text } from "@football/ui";

import { ConfirmDialog } from "@/components/confirm-dialog/confirm-dialog";
import {
  authErrorMessage,
  networkAuthErrorMessage,
} from "@/features/auth/auth-errors";
import { authClient } from "@/lib/auth/auth-client";
import { SettingsFrame } from "@/features/profile-settings/settings-visual";

import styles from "./account-security.module.css";

const accountSessionKey = ["auth", "sessions"] as const;

export function AccountSecurityScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const currentSession = authClient.useSession();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const sessions = useQuery({
    queryKey: accountSessionKey,
    queryFn: async () => {
      const result = await authClient.listSessions();
      if (result.error) throw new Error(authErrorMessage(result.error));
      return result.data ?? [];
    },
  });

  async function changePassword(formData: FormData) {
    const newPassword = formValue(formData, "newPassword");
    if (newPassword !== formValue(formData, "confirmation")) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }
    setPendingAction("password");
    resetMessages();
    try {
      const result = await authClient.changePassword({
        currentPassword: formValue(formData, "currentPassword"),
        newPassword,
        revokeOtherSessions: true,
      });
      if (result.error) {
        setError(authErrorMessage(result.error));
        return;
      }
      setFeedback(
        "Contraseña actualizada. La sesión actual continúa activa y las demás fueron cerradas.",
      );
      await queryClient.invalidateQueries({ queryKey: accountSessionKey });
    } catch (cause) {
      setError(networkAuthErrorMessage(cause));
    } finally {
      setPendingAction(null);
    }
  }

  async function closeOtherSessions() {
    setPendingAction("others");
    resetMessages();
    try {
      const result = await authClient.revokeOtherSessions();
      if (result.error) {
        setError(authErrorMessage(result.error));
        return;
      }
      setFeedback("Las demás sesiones quedaron cerradas.");
      await queryClient.invalidateQueries({ queryKey: accountSessionKey });
    } catch (cause) {
      setError(networkAuthErrorMessage(cause));
    } finally {
      setPendingAction(null);
    }
  }

  async function revokeSession(token: string, isCurrent: boolean) {
    setPendingAction(token);
    resetMessages();
    try {
      const result = await authClient.revokeSession({ token });
      if (result.error) {
        setError(authErrorMessage(result.error));
        return;
      }
      if (isCurrent) {
        await authClient.signOut();
        queryClient.clear();
        router.replace("/auth");
        return;
      }
      setFeedback("Sesión cerrada.");
      await queryClient.invalidateQueries({ queryKey: accountSessionKey });
    } catch (cause) {
      setError(networkAuthErrorMessage(cause));
    } finally {
      setPendingAction(null);
    }
  }

  async function deleteAccount() {
    if (deleteConfirmation !== "ELIMINAR MI CUENTA" || !deletePassword) return;
    setDeleteDialogOpen(false);
    setPendingAction("delete");
    resetMessages();
    try {
      const result = await authClient.deleteUser({ password: deletePassword });
      if (result.error) {
        setError(authErrorMessage(result.error));
        return;
      }
      queryClient.clear();
      router.replace("/auth?deleted=1");
    } catch (cause) {
      setError(networkAuthErrorMessage(cause));
    } finally {
      setPendingAction(null);
    }
  }

  function resetMessages() {
    setError(null);
    setFeedback(null);
  }

  return (
    <SettingsFrame
      active="account"
      description="Protegé el acceso, revisá tus dispositivos y controlá las acciones sensibles."
      eyebrow="CUENTA Y SEGURIDAD"
      title="Seguridad"
    >
      <div className={styles.page}>
        <section className={styles.section} aria-labelledby="password-title">
          <header className={styles.sectionIntro}>
            <span>CONTRASEÑA</span>
            <h2 id="password-title">Cambiar contraseña</h2>
            <p>Actualizá tu clave de acceso. Las demás sesiones se cerrarán.</p>
          </header>
          <form action={changePassword} className={styles.form}>
            <Field
              autoComplete="current-password"
              label="Contraseña actual"
              name="currentPassword"
            />
            <Field
              autoComplete="new-password"
              label="Nueva contraseña"
              maxLength={128}
              minLength={8}
              name="newPassword"
            />
            <Field
              autoComplete="new-password"
              label="Confirmar contraseña"
              maxLength={128}
              minLength={8}
              name="confirmation"
            />
            <Button disabled={pendingAction !== null} type="submit">
              {pendingAction === "password"
                ? "Actualizando…"
                : "Cambiar contraseña"}
            </Button>
          </form>
        </section>

        <section className={styles.section} aria-labelledby="sessions-title">
          <div className={styles.sectionHeading}>
            <header className={styles.sectionIntro}>
              <span>DISPOSITIVOS</span>
              <h2 id="sessions-title">Sesiones activas</h2>
              <p>Revisá dónde permanece abierta tu cuenta.</p>
            </header>
            <Button
              disabled={pendingAction !== null || sessions.data?.length === 1}
              onClick={() => void closeOtherSessions()}
              variant="secondary"
            >
              Cerrar otras sesiones
            </Button>
          </div>

          {sessions.isPending ? <p role="status">Cargando sesiones…</p> : null}
          {sessions.isError ? (
            <p className={styles.error} role="alert">
              No pudimos cargar las sesiones activas.
            </p>
          ) : null}
          <div
            aria-label="Lista de sesiones activas"
            className={styles.sessions}
            role="region"
            tabIndex={0}
          >
            {sessions.data?.map((session) => {
              const isCurrent = session.id === currentSession.data?.session.id;
              return (
                <article className={styles.session} key={session.id}>
                  <span aria-hidden="true" className={styles.device}>
                    WEB
                  </span>
                  <div className={styles.sessionCopy}>
                    <Text as="h3" variant="heading-md">
                      {summarizeUserAgent(session.userAgent)}
                    </Text>
                    <Text tone="muted" variant="metadata">
                      Iniciada {formatDate(session.createdAt)} · vence{" "}
                      {formatDate(session.expiresAt)}
                    </Text>
                    {isCurrent ? (
                      <span className={styles.current}>Sesión actual</span>
                    ) : null}
                  </div>
                  <Button
                    disabled={pendingAction !== null}
                    onClick={() => void revokeSession(session.token, isCurrent)}
                    variant="secondary"
                  >
                    {isCurrent ? "Cerrar esta sesión" : "Revocar"}
                  </Button>
                </article>
              );
            })}
          </div>
        </section>

        <section className={styles.danger} id="delete-account">
          <header className={styles.sectionIntro}>
            <span>ZONA DE RIESGO</span>
            <h2>Eliminar cuenta</h2>
          </header>
          <p>
            Se eliminan credenciales, sesiones, conexiones, invitaciones,
            preferencias declaradas y foto. La evidencia deportiva confirmada se
            conserva anonimizada. Si sos la única persona dueña de un grupo con
            partidos activos, primero debés transferir la propiedad o
            resolverlos.
          </p>
          <p>
            Leé <Link href="/privacy">Privacidad</Link> antes de continuar.
          </p>
          <label className={styles.field}>
            <span>Escribí ELIMINAR MI CUENTA</span>
            <input
              aria-describedby="delete-account-help"
              autoComplete="off"
              name="delete-account-confirmation"
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              value={deleteConfirmation}
            />
          </label>
          <Text
            as="span"
            id="delete-account-help"
            tone="muted"
            variant="metadata"
          >
            Esta confirmación evita eliminar la cuenta por accidente.
          </Text>
          <label className={styles.field}>
            <span>Contraseña actual</span>
            <input
              autoComplete="current-password"
              onChange={(event) => setDeletePassword(event.target.value)}
              type="password"
              value={deletePassword}
            />
          </label>
          <Button
            disabled={
              pendingAction !== null ||
              deleteConfirmation !== "ELIMINAR MI CUENTA" ||
              !deletePassword
            }
            onClick={() => setDeleteDialogOpen(true)}
            variant="danger"
          >
            Revisar eliminación
          </Button>
        </section>

        <ConfirmDialog
          confirmDisabled={pendingAction !== null}
          confirmLabel={
            pendingAction === "delete" ? "Eliminando…" : "Eliminar cuenta"
          }
          eyebrow="ELIMINAR CUENTA"
          message="Perderás el acceso inmediatamente y todas tus sesiones se cerrarán. Tu identidad quedará anonimizada donde sea necesario conservar historia deportiva."
          onCancel={() => setDeleteDialogOpen(false)}
          onConfirm={() => void deleteAccount()}
          open={deleteDialogOpen}
          tone="danger"
          title="¿Eliminar definitivamente tu cuenta?"
        />

        {feedback ? (
          <p className={styles.feedback} role="status">
            {feedback}
          </p>
        ) : null}
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </SettingsFrame>
  );
}

function Field({
  autoComplete,
  label,
  maxLength,
  minLength,
  name,
}: Readonly<{
  autoComplete: string;
  label: string;
  maxLength?: number;
  minLength?: number;
  name: string;
}>) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input
        aria-label={label}
        autoComplete={autoComplete}
        maxLength={maxLength}
        minLength={minLength}
        name={name}
        required
        type="password"
      />
    </label>
  );
}

function summarizeUserAgent(userAgent: string | null | undefined) {
  if (!userAgent) return "Dispositivo no identificado";
  if (userAgent.includes("Firefox")) return "Firefox";
  if (userAgent.includes("Edg/")) return "Microsoft Edge";
  if (userAgent.includes("Chrome")) return "Chrome";
  if (userAgent.includes("Safari")) return "Safari";
  return "Navegador web";
}

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    hourCycle: "h23",
  }).format(new Date(value));
}

function formValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
