"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button, Text } from "@football/ui";
import { ApiError } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { api } from "@/lib/api/resources";
import { authClient } from "@/lib/auth/auth-client";
import { emailVerificationRequired } from "@/lib/auth/auth-client";

import { authErrorMessage } from "./auth-errors";

import styles from "./auth-screen.module.css";

export function AuthScreen({ returnTo }: Readonly<{ returnTo: string }>) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const authSession = authClient.useSession();
  const submitting = useRef(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError(null);
    try {
      const email = formValue(formData, "email");
      const password = formValue(formData, "password");
      const result =
        mode === "register"
          ? await authClient.signUp.email({
              name: formValue(formData, "name"),
              email,
              password,
              callbackURL: `${window.location.origin}/auth/verify-email?verified=1`,
            })
          : await authClient.signIn.email({ email, password });
      if (result.error) {
        if (result.error.code === "EMAIL_NOT_VERIFIED") {
          router.replace("/auth/verify-email");
          return;
        }
        setError(authErrorMessage(result.error));
        return;
      }

      if (mode === "register" && emailVerificationRequired) {
        queryClient.clear();
        router.replace("/auth/verify-email?sent=1");
        return;
      }

      const confirmedSession = await authClient.getSession();
      if (confirmedSession.error || !confirmedSession.data?.user) {
        setError(
          "El acceso fue aceptado, pero no pudimos confirmar la sesión. Intentá nuevamente.",
        );
        return;
      }

      await authSession.refetch();
      queryClient.clear();

      const compliance = await api.compliance();
      queryClient.setQueryData(queryKeys.compliance, compliance);
      if (
        compliance.state !== "READY" &&
        compliance.state !== "FOOTBALL_PROFILE_REQUIRED"
      ) {
        router.replace("/onboarding/compliance");
        return;
      }
      const player = await api.me();
      const preferences = await api.preferences();
      queryClient.setQueryData(queryKeys.me, player);
      queryClient.setQueryData(queryKeys.footballPreferences, preferences);

      router.replace(returnTo);
    } catch (cause) {
      setError(authFlowErrorMessage(cause));
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.identity}>
        <span className={styles.mark}>F5</span>
        <Text tone="accent" variant="label">
          NIGHT PITCH · PLAYER ACCESS
        </Text>
        <Text as="h1" variant="display-lg">
          Tu fútbol empieza acá.
        </Text>
        <Text tone="muted">
          Entrá, armá tu identidad F5 y volvé a jugar con tu grupo.
        </Text>
      </section>
      <section className={styles.formPanel}>
        <div className={styles.mode} aria-label="Tipo de acceso">
          <button
            aria-pressed={mode === "login"}
            onClick={() => setMode("login")}
            type="button"
          >
            Ingresar
          </button>
          <button
            aria-pressed={mode === "register"}
            onClick={() => setMode("register")}
            type="button"
          >
            Crear cuenta
          </button>
        </div>
        <form action={submit} className={styles.form}>
          <Text as="h2" variant="heading-lg">
            {mode === "login" ? "Volvé a la cancha." : "Creá tu jugador."}
          </Text>
          {mode === "register" && (
            <Field autoComplete="name" label="Nombre" name="name" type="text" />
          )}
          <Field autoComplete="email" label="Email" name="email" type="email" />
          <Field
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            label="Contraseña"
            minLength={12}
            name="password"
            type="password"
          />
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <Button disabled={pending} type="submit">
            {pending
              ? "Procesando…"
              : mode === "login"
                ? "Ingresar"
                : "Crear cuenta"}
          </Button>
          {mode === "login" ? (
            <Link className={styles.secondaryLink} href="/auth/forgot-password">
              Olvidé mi contraseña
            </Link>
          ) : null}
          <p className={styles.legal}>
            Al crear una cuenta deberás confirmar que sos mayor de 18 años y
            aceptar nuestros <Link href="/terms">Términos</Link> y la{" "}
            <Link href="/privacy">Política de Privacidad</Link>.
          </p>
        </form>
      </section>
    </main>
  );
}

function formValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function authFlowErrorMessage(cause: unknown) {
  if (cause instanceof ApiError) {
    if (cause.status === 401) {
      return "La sesión no quedó disponible para cargar tu jugador. Volvé a ingresar.";
    }
    return cause.message;
  }
  if (cause instanceof TypeError)
    return "No pudimos conectar con el servidor. Verificá que el API esté disponible e intentá nuevamente.";
  return "No pudimos completar el acceso. Intentá nuevamente.";
}

function Field({
  label,
  ...input
}: Readonly<{
  label: string;
  name: string;
  type: string;
  autoComplete: string;
  minLength?: number;
}>) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input {...input} aria-label={label} required />
    </label>
  );
}
