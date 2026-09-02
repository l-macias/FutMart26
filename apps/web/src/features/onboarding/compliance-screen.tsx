"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Button, Text } from "@football/ui";

import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";
import { authClient } from "@/lib/auth/auth-client";

import styles from "./compliance-screen.module.css";

export function ComplianceScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = authClient.useSession();
  const compliance = useQuery({
    queryKey: queryKeys.compliance,
    queryFn: api.compliance,
    enabled: Boolean(session.data?.user),
    retry: false,
  });
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const complete = useMutation({
    mutationFn: api.completeCompliance,
    onSuccess: async (result) => {
      queryClient.setQueryData(queryKeys.compliance, result);
      await queryClient.invalidateQueries({ queryKey: queryKeys.me });
      router.replace("/play");
    },
  });

  useEffect(() => {
    if (!session.isPending && !session.data?.user) router.replace("/auth");
  }, [router, session.data?.user, session.isPending]);
  useEffect(() => {
    if (
      compliance.data?.state === "READY" ||
      compliance.data?.state === "FOOTBALL_PROFILE_REQUIRED"
    )
      router.replace("/play");
  }, [compliance.data?.state, router]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (complete.isPending || !acceptedTerms || !acceptedPrivacy) return;
    complete.mutate({
      ...(compliance.data?.hasDateOfBirth ? {} : { dateOfBirth }),
      acceptTerms: true,
      acceptPrivacy: true,
    });
  }

  async function logout() {
    await authClient.signOut();
    queryClient.clear();
    router.replace("/auth");
  }

  if (session.isPending || compliance.isPending)
    return <main className={styles.state}>Verificando acceso…</main>;
  if (!session.data?.user)
    return <main className={styles.state}>Abriendo acceso…</main>;
  if (compliance.isError)
    return (
      <main className={styles.state}>
        No pudimos verificar los requisitos de tu cuenta.
      </main>
    );
  if (
    compliance.data.state === "READY" ||
    compliance.data.state === "FOOTBALL_PROFILE_REQUIRED"
  ) {
    return <main className={styles.state}>Entrando a la cancha…</main>;
  }
  if (compliance.data.state === "UNDERAGE")
    return (
      <main className={styles.page}>
        <Text tone="accent" variant="label">
          BETA +18
        </Text>
        <Text as="h1" variant="display-lg">
          Este acceso es sólo para mayores de 18 años.
        </Text>
        <Text tone="muted">
          Tu cuenta no puede usar las superficies deportivas de esta beta.
        </Text>
        <Button onClick={() => void logout()} variant="secondary">
          Cerrar sesión
        </Button>
      </main>
    );

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Text tone="accent" variant="label">
          ACCESO RESPONSABLE · BETA +18
        </Text>
        <Text as="h1" variant="display-lg">
          Antes de entrar a jugar.
        </Text>
        <Text tone="muted">
          Confirmá tu edad y las reglas vigentes. Tu fecha de nacimiento es
          privada y sólo mostramos tu edad derivada en tu área privada.
        </Text>
      </header>
      <form className={styles.form} onSubmit={submit}>
        {!compliance.data.hasDateOfBirth ? (
          <label className={styles.field}>
            Fecha de nacimiento
            <input
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setDateOfBirth(event.target.value)}
              required
              type="date"
              value={dateOfBirth}
            />
          </label>
        ) : null}
        <label className={styles.check}>
          <input
            checked={acceptedTerms}
            onChange={(event) => setAcceptedTerms(event.target.checked)}
            type="checkbox"
          />
          <span>
            Acepto los{" "}
            <Link href="/terms" target="_blank">
              Términos v1
            </Link>
            .
          </span>
        </label>
        <label className={styles.check}>
          <input
            checked={acceptedPrivacy}
            onChange={(event) => setAcceptedPrivacy(event.target.checked)}
            type="checkbox"
          />
          <span>
            Leí y acepto la{" "}
            <Link href="/privacy" target="_blank">
              Política de Privacidad v1
            </Link>
            .
          </span>
        </label>
        {complete.isError ? (
          <p className={styles.error} role="alert">
            {complete.error.message}
          </p>
        ) : null}
        <div className={styles.actions}>
          <Button
            disabled={complete.isPending || !acceptedTerms || !acceptedPrivacy}
            type="submit"
          >
            {complete.isPending ? "Confirmando…" : "Confirmar y continuar"}
          </Button>
          <Button onClick={() => void logout()} type="button" variant="quiet">
            Cerrar sesión
          </Button>
        </div>
      </form>
    </main>
  );
}
