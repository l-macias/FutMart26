"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect } from "react";

import { Text } from "@football/ui";

import { FootballOnboarding } from "@/features/onboarding/football-onboarding";
import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";
import { ApiError } from "@/lib/api/client";
import { authClient, emailVerificationRequired } from "@/lib/auth/auth-client";

import styles from "./auth-gate.module.css";

export function AuthGate({ children }: Readonly<{ children: ReactNode }>) {
  const router = useRouter();
  const pathname = usePathname();
  const session = authClient.useSession();
  const compliance = useQuery({
    queryKey: queryKeys.compliance,
    queryFn: api.compliance,
    enabled: Boolean(
      session.data?.user &&
      (!emailVerificationRequired || session.data.user.emailVerified),
    ),
    retry: false,
  });
  const player = useQuery({
    queryKey: queryKeys.me,
    queryFn: api.me,
    enabled: Boolean(
      compliance.data?.state === "READY" ||
      compliance.data?.state === "FOOTBALL_PROFILE_REQUIRED",
    ),
    retry: false,
  });
  const preferences = useQuery({
    queryKey: queryKeys.footballPreferences,
    queryFn: api.preferences,
    enabled: player.isSuccess,
    retry: false,
  });

  useEffect(() => {
    if (!session.isPending && !session.error && !session.data?.user) {
      const returnTo = encodeURIComponent(pathname || "/");
      router.replace(`/auth?returnTo=${returnTo}`);
    }
  }, [pathname, router, session.data?.user, session.error, session.isPending]);

  useEffect(() => {
    if (
      emailVerificationRequired &&
      session.data?.user &&
      !session.data.user.emailVerified
    ) {
      router.replace("/auth/verify-email");
    }
  }, [router, session.data?.user]);

  useEffect(() => {
    if (
      compliance.error instanceof ApiError &&
      compliance.error.code === "account_suspended"
    )
      router.replace("/suspended");
  }, [compliance.error, router]);

  useEffect(() => {
    if (
      compliance.data &&
      compliance.data.state !== "READY" &&
      compliance.data.state !== "FOOTBALL_PROFILE_REQUIRED"
    )
      router.replace("/onboarding/compliance");
  }, [compliance.data, router]);

  if (
    session.isPending ||
    (session.data?.user && compliance.isPending) ||
    (compliance.isSuccess && player.isPending)
  )
    return <GateStatus label="Preparando tu cancha…" />;
  if (session.error && !session.data?.user)
    return (
      <GateStatus label="No pudimos verificar tu sesión porque el servidor no está disponible. Intentá nuevamente cuando vuelva la conexión." />
    );
  if (!session.data?.user) return <GateStatus label="Abriendo acceso…" />;
  if (emailVerificationRequired && !session.data.user.emailVerified)
    return <GateStatus label="Esperando la verificación de tu email…" />;
  if (compliance.isError || player.isError || preferences.isError)
    return (
      <GateStatus label="No pudimos cargar tu perfil. Revisá la conexión e intentá nuevamente." />
    );
  if (
    !compliance.data ||
    (compliance.data.state !== "READY" &&
      compliance.data.state !== "FOOTBALL_PROFILE_REQUIRED")
  )
    return <GateStatus label="Completando requisitos de acceso…" />;
  if (preferences.isPending || !player.data)
    return <GateStatus label="Cargando tu perfil F5…" />;
  if (!preferences.data.configured)
    return <FootballOnboarding playerName={player.data.displayName} />;
  return children;
}

function GateStatus({ label }: Readonly<{ label: string }>) {
  return (
    <main className={styles.status}>
      <span aria-hidden="true" className={styles.mark}>
        F5
      </span>
      <Text as="h1" variant="heading-lg">
        {label}
      </Text>
    </main>
  );
}
