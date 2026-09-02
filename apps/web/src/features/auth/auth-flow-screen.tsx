"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { Button, Text } from "@football/ui";

import { authClient } from "@/lib/auth/auth-client";

import { authErrorMessage, networkAuthErrorMessage } from "./auth-errors";
import styles from "./auth-flow.module.css";

export function ForgotPasswordScreen() {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setPending(true);
    setError(null);
    try {
      const result = await authClient.requestPasswordReset({
        email: formValue(formData, "email"),
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (result.error) {
        setError(authErrorMessage(result.error));
        return;
      }
      setSent(true);
    } catch (cause) {
      setError(networkAuthErrorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFlowLayout eyebrow="RECUPERAR ACCESO" title="Volvé a la cancha.">
      {sent ? (
        <StatusMessage>
          Si existe una cuenta asociada, te enviamos instrucciones para cambiar
          la contraseña.
        </StatusMessage>
      ) : (
        <form action={submit} className={styles.form}>
          <Text tone="muted">
            Ingresá tu email. La respuesta será la misma exista o no una cuenta.
          </Text>
          <Field autoComplete="email" label="Email" name="email" type="email" />
          <ErrorMessage error={error} />
          <Button disabled={pending} type="submit">
            {pending ? "Enviando…" : "Enviar instrucciones"}
          </Button>
        </form>
      )}
      <BackToLogin />
    </AuthFlowLayout>
  );
}

export function ResetPasswordScreen({
  errorCode,
  token,
}: Readonly<{ errorCode?: string; token?: string }>) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(
    errorCode || !token
      ? "El enlace ya no es válido. Solicitá uno nuevo."
      : null,
  );

  async function submit(formData: FormData) {
    if (!token) return;
    const password = formValue(formData, "password");
    const confirmation = formValue(formData, "confirmation");
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (result.error) {
        setError(authErrorMessage(result.error));
        return;
      }
      queryClient.clear();
      setComplete(true);
    } catch (cause) {
      setError(networkAuthErrorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFlowLayout eyebrow="NUEVA CONTRASEÑA" title="Recuperá tu cuenta.">
      {complete ? (
        <StatusMessage>
          La contraseña fue actualizada y las sesiones anteriores quedaron
          cerradas. Ingresá nuevamente.
        </StatusMessage>
      ) : (
        <form action={submit} className={styles.form}>
          <Field
            autoComplete="new-password"
            disabled={!token}
            label="Nueva contraseña"
            minLength={12}
            name="password"
            type="password"
          />
          <Field
            autoComplete="new-password"
            disabled={!token}
            label="Confirmar contraseña"
            minLength={12}
            name="confirmation"
            type="password"
          />
          <ErrorMessage error={error} />
          <Button disabled={pending || !token} type="submit">
            {pending ? "Actualizando…" : "Cambiar contraseña"}
          </Button>
        </form>
      )}
      <BackToLogin />
    </AuthFlowLayout>
  );
}

export function VerifyEmailScreen({
  errorCode,
  sent,
  verified,
}: Readonly<{ errorCode?: string; sent: boolean; verified: boolean }>) {
  const [pending, setPending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(
    errorCode ? "El enlace ya no es válido. Solicitá uno nuevo." : null,
  );

  async function resend(formData: FormData) {
    setPending(true);
    setError(null);
    try {
      const result = await authClient.sendVerificationEmail({
        email: formValue(formData, "email"),
        callbackURL: `${window.location.origin}/auth/verify-email?verified=1`,
      });
      if (result.error) {
        setError(authErrorMessage(result.error));
        return;
      }
      setResent(true);
    } catch (cause) {
      setError(networkAuthErrorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFlowLayout eyebrow="VERIFICAR EMAIL" title="Confirmá tu acceso.">
      {verified ? (
        <StatusMessage>
          Tu email quedó verificado. Ya podés ingresar a F5 Groups.
        </StatusMessage>
      ) : (
        <>
          <StatusMessage>
            {sent || resent
              ? "Te enviamos un enlace de verificación. Revisá también spam o correo no deseado."
              : "Necesitás verificar tu email antes de entrar al producto."}
          </StatusMessage>
          <form action={resend} className={styles.form}>
            <Field
              autoComplete="email"
              label="Email"
              name="email"
              type="email"
            />
            <ErrorMessage error={error} />
            <Button disabled={pending} type="submit">
              {pending ? "Enviando…" : "Reenviar verificación"}
            </Button>
          </form>
        </>
      )}
      <BackToLogin />
    </AuthFlowLayout>
  );
}

function AuthFlowLayout({
  children,
  eyebrow,
  title,
}: Readonly<{ children: React.ReactNode; eyebrow: string; title: string }>) {
  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <span aria-hidden="true" className={styles.mark}>
          F5
        </span>
        <Text tone="accent" variant="label">
          {eyebrow}
        </Text>
        <Text as="h1" variant="display-lg">
          {title}
        </Text>
        {children}
      </section>
    </main>
  );
}

function StatusMessage({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <p className={styles.status} role="status">
      {children}
    </p>
  );
}

function ErrorMessage({ error }: Readonly<{ error: string | null }>) {
  return error ? (
    <p className={styles.error} role="alert">
      {error}
    </p>
  ) : null;
}

function BackToLogin() {
  return (
    <Link className="ui-button ui-button--secondary" href="/auth">
      Volver a ingresar
    </Link>
  );
}

function Field({
  label,
  ...input
}: Readonly<{
  autoComplete: string;
  disabled?: boolean;
  label: string;
  minLength?: number;
  name: string;
  type: string;
}>) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input {...input} aria-label={label} required />
    </label>
  );
}

function formValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
