"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button, Text } from "@football/ui";
import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";
import { authClient } from "@/lib/auth/auth-client";
import styles from "./invitation-screen.module.css";

export function InvitationScreen({ token }: Readonly<{ token: string }>) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = authClient.useSession();
  const preview = useQuery({
    queryKey: queryKeys.invitationPreview(token),
    queryFn: () => api.invitationPreview(token),
    retry: false,
  });
  const join = useMutation({
    mutationFn: () => api.joinInvitation(token),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.groups });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.groupMembers(result.groupId),
      });
      router.push(`/groups/${result.groupId}`);
    },
  });
  if (preview.isPending)
    return <InvitationStatus>Validando invitación…</InvitationStatus>;
  if (preview.isError || !preview.data.available)
    return (
      <InvitationStatus unavailable>
        Esta invitación ya no está disponible.
      </InvitationStatus>
    );
  const returnTo = `/invite/${encodeURIComponent(token)}`;
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <span aria-hidden="true" className={styles.mark}>
          F5
        </span>
        <Text tone="accent" variant="label">
          INVITACIÓN DE GRUPO
        </Text>
        <Text tone="muted">Fuiste invitado a</Text>
        <Text as="h1" variant="display-lg">
          {preview.data.groupName}
        </Text>
        <div className={styles.line} />
        {session.isPending ? (
          <p role="status">Comprobando sesión…</p>
        ) : session.data?.user ? (
          <Button disabled={join.isPending} onClick={() => join.mutate()}>
            {join.isPending ? "Uniéndote…" : "Unirme al grupo"}
          </Button>
        ) : (
          <Button
            onClick={() =>
              router.push(`/auth?returnTo=${encodeURIComponent(returnTo)}`)
            }
          >
            Ingresar para continuar
          </Button>
        )}
        {join.isError && (
          <p className={styles.error} role="alert">
            {join.error.message}
          </p>
        )}
        <Text tone="muted" variant="metadata">
          EL ACCESO NO SE CONSUME HASTA QUE CONFIRMES
        </Text>
      </section>
    </main>
  );
}

function InvitationStatus({
  children,
  unavailable = false,
}: Readonly<{ children: string; unavailable?: boolean }>) {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <span aria-hidden="true" className={styles.mark}>
          F5
        </span>
        <Text tone={unavailable ? "muted" : "accent"} variant="label">
          INVITACIÓN
        </Text>
        <Text as="h1" variant="heading-lg">
          {children}
        </Text>
        {unavailable && (
          <Button onClick={() => window.location.assign("/auth")}>
            Ir al acceso
          </Button>
        )}
      </section>
    </main>
  );
}
