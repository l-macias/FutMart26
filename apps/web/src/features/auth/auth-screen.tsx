"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@football/ui";
import { ApiError } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { api } from "@/lib/api/resources";
import { authClient } from "@/lib/auth/auth-client";
import { emailVerificationRequired } from "@/lib/auth/auth-client";

import { authErrorMessage } from "./auth-errors";
import { AuthVisualScene } from "./auth-visual-scene";

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
    <main className={`${styles.page} ui-visual-v4`}>
      <AuthVisualScene
        eyebrow="Tu identidad futbolística"
        title="Tu fútbol empieza acá."
      />
      <section className={styles.access}>
        <div className={styles.panel}>
          <header className={styles.panelHeader}>
            <span>Acceso FIFAR</span>
            <h2>{mode === "login" ? "Volvé a jugar." : "Creá tu jugador."}</h2>
            <p>
              {mode === "login"
                ? "Ingresá a tu vestuario digital."
                : "Empezá a construir tu identidad F5."}
            </p>
          </header>
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
            {mode === "register" && (
              <Field
                autoComplete="name"
                index="01"
                label="Nombre"
                name="name"
                type="text"
              />
            )}
            <Field
              autoComplete="email"
              index={mode === "register" ? "02" : "01"}
              label="Email"
              name="email"
              type="email"
            />
            <Field
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              index={mode === "register" ? "03" : "02"}
              label="Contraseña"
              maxLength={128}
              minLength={8}
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
              <Link
                className={styles.secondaryLink}
                href="/auth/forgot-password"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            ) : null}
            <p className={styles.legal}>
              Al crear una cuenta deberás confirmar que sos mayor de 18 años y
              aceptar nuestros <Link href="/terms">Términos</Link> y la{" "}
              <Link href="/privacy">Política de Privacidad</Link>.
            </p>
          </form>
        </div>
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
  index,
  label,
  ...input
}: Readonly<{
  index: string;
  label: string;
  name: string;
  type: string;
  autoComplete: string;
  maxLength?: number;
  minLength?: number;
}>) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <span className={styles.inputShell}>
        <span aria-hidden="true" className={styles.fieldIndex}>
          {index}
        </span>
        <input {...input} aria-label={label} required />
      </span>
    </label>
  );
}
