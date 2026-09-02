"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Button, Text } from "@football/ui";
import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";
import styles from "./groups.module.css";

export function GroupsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const groups = useQuery({ queryKey: queryKeys.groups, queryFn: api.groups });
  const create = useMutation({
    mutationFn: api.createGroup,
    onSuccess: async (group) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.groups });
      router.push(`/groups/${group.id}`);
    },
  });
  const activeGroups =
    groups.data?.filter((group) => group.status === "ACTIVE") ?? [];
  const archivedGroups =
    groups.data?.filter((group) => group.status === "ARCHIVED") ?? [];
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <Text tone="accent" variant="label">
            03 · GRUPOS
          </Text>
          <Text as="h1" variant="display-lg">
            Tu vestuario.
          </Text>
          <Text tone="muted">
            Los grupos donde organizás y jugás tu fútbol.
          </Text>
        </div>
        <Button onClick={() => setCreating((value) => !value)}>
          {creating ? "Cerrar" : "Crear grupo"}
        </Button>
      </header>
      {creating && (
        <form
          action={(data) => {
            const name = data.get("name");
            create.mutate(typeof name === "string" ? name : "");
          }}
          className={styles.createForm}
        >
          <label>
            <span>Nombre del grupo</span>
            <input
              autoFocus
              maxLength={100}
              minLength={1}
              name="name"
              placeholder="Los del martes"
              required
            />
          </label>
          {create.isError && (
            <p className={styles.error} role="alert">
              {create.error.message}
            </p>
          )}
          <Button disabled={create.isPending} type="submit">
            {create.isPending ? "Creando…" : "Crear grupo"}
          </Button>
        </form>
      )}
      {groups.isPending ? (
        <Status>Buscando tus grupos…</Status>
      ) : groups.isError ? (
        <Status error>{groups.error.message}</Status>
      ) : groups.data.length === 0 ? (
        <section className={styles.empty}>
          <Text as="h2" variant="heading-lg">
            Todavía no pertenecés a ningún grupo.
          </Text>
          <Text tone="muted">
            Creá el primero o abrí el enlace que te compartió un organizador.
          </Text>
          <Button onClick={() => setCreating(true)}>Crear grupo</Button>
        </section>
      ) : (
        <>
          <section aria-label="Mis grupos activos" className={styles.groupList}>
            {activeGroups.map((group, index) => (
              <Link
                className={styles.groupRow}
                href={`/groups/${group.id}`}
                key={group.id}
              >
                <span className={styles.index}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>
                  <strong>{group.name}</strong>
                  <small>{group.role}</small>
                </span>
                <span aria-hidden="true">→</span>
              </Link>
            ))}
          </section>
          {archivedGroups.length > 0 && (
            <section
              aria-label="Grupos archivados"
              className={styles.groupList}
            >
              <Text as="h2" variant="heading-md">
                ARCHIVADOS
              </Text>
              {archivedGroups.map((group, index) => (
                <Link
                  className={styles.groupRow}
                  href={`/groups/${group.id}`}
                  key={group.id}
                >
                  <span className={styles.index}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <strong>{group.name}</strong>
                    <small>{group.role} · ARCHIVED</small>
                  </span>
                  <span aria-hidden="true">→</span>
                </Link>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Status({
  children,
  error = false,
}: Readonly<{ children: ReactNode; error?: boolean }>) {
  return (
    <p
      className={error ? styles.error : styles.status}
      role={error ? "alert" : "status"}
    >
      {children}
    </p>
  );
}
