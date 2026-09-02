"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

import { Button, Text } from "@football/ui";
import type { MembershipResponse } from "@football/contracts";
import { ConfirmDialog } from "@/components/confirm-dialog/confirm-dialog";
import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";

import styles from "./group-settings.module.css";

type Command = {
  title: string;
  message: string;
  confirmLabel: string;
  run: () => Promise<void>;
  leaveAfter?: boolean;
};
type Capability = MembershipResponse["capabilities"][number];

const capabilityLabels: Partial<Record<Capability, string>> = {
  GROUP_MANAGE_MEMBERS: "Administrar miembros",
  GROUP_MANAGE_MODERATORS: "Administrar moderadores",
  GROUP_TRANSFER_OWNERSHIP: "Transferir propiedad",
  GROUP_ARCHIVE: "Archivar grupo",
  MATCH_MANAGE: "Administrar partidos",
  MATCH_MANAGE_GUESTS: "Administrar invitados en partidos",
  MATCH_COMPLETE: "Finalizar partidos",
  MATCH_CONFIRM_ROSTER: "Confirmar asistencia",
  MATCH_MANAGE_STATS: "Cargar resultados y estadísticas",
  MATCH_MANAGE_OBSERVER: "Administrar observadores",
  MATCH_MANAGE_VOTING: "Administrar votación",
  MATCH_MANAGE_TEAMS: "Administrar equipos",
  GROUP_MANAGE_INVITATIONS: "Administrar invitaciones",
  GROUP_MANAGE_GUEST_POLICY: "Configurar política de invitados",
  GROUP_MANAGE_GUESTS: "Administrar directorio de invitados",
  MATCH_GUEST_OVERRIDE: "Excepciones de cupo para invitados",
};

const configurableCapabilities = Object.keys(capabilityLabels) as Capability[];

export function GroupSettingsScreen({
  groupId,
}: Readonly<{ groupId: string }>) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState<Command | null>(null);
  const [name, setName] = useState("");
  const [newGuestName, setNewGuestName] = useState("");

  const group = useQuery({
    queryKey: queryKeys.group(groupId),
    queryFn: () => api.group(groupId),
  });
  const me = useQuery({ queryKey: queryKeys.me, queryFn: api.me });
  const members = useQuery({
    queryKey: queryKeys.groupMembers(groupId, group.data?.role === "OWNER"),
    queryFn: () => api.members(groupId, group.data?.role === "OWNER"),
    enabled: group.isSuccess,
  });
  const canManageInvitations =
    group.data?.capabilities.includes("GROUP_MANAGE_INVITATIONS") ?? false;
  const canReadGuests = group.data?.status === "ACTIVE";
  const invitations = useQuery({
    queryKey: queryKeys.invitations(groupId),
    queryFn: () => api.invitations(groupId),
    enabled: canManageInvitations,
  });
  const directedInvitations = useQuery({
    queryKey: queryKeys.managedDirectedGroupInvitations(groupId),
    queryFn: () => api.managedDirectedGroupInvitations(groupId),
    enabled: canManageInvitations,
  });
  const guests = useQuery({
    queryKey: queryKeys.groupGuests(groupId),
    queryFn: () => api.groupGuests(groupId),
    enabled: canReadGuests,
  });
  const guestPolicy = useQuery({
    queryKey: queryKeys.guestPolicy(groupId),
    queryFn: () => api.guestPolicy(groupId),
    enabled: canReadGuests,
  });

  const command = useMutation({
    mutationFn: async (item: Command) => item.run(),
    onSuccess: async (_, item) => {
      await invalidateGroupManagement(queryClient, groupId);
      setConfirm(null);
      if (item.leaveAfter) router.push("/groups");
    },
  });

  const activeMembers = useMemo(
    () => members.data?.filter((member) => member.status === "ACTIVE") ?? [],
    [members.data],
  );
  const blockedMembers = useMemo(
    () => members.data?.filter((member) => member.status === "BLOCKED") ?? [],
    [members.data],
  );

  if (group.isPending || me.isPending || members.isPending)
    return <main className={styles.page}>Cargando configuración…</main>;
  if (group.isError || me.isError || members.isError)
    return (
      <main className={styles.page}>
        <p className={styles.error} role="alert">
          {group.error?.message ?? me.error?.message ?? members.error?.message}
        </p>
      </main>
    );

  const isOwner = group.data.role === "OWNER";
  const currentGroupName = group.data.name;
  const isArchived = group.data.status === "ARCHIVED";
  const canManageMembers = group.data.capabilities.includes(
    "GROUP_MANAGE_MEMBERS",
  );
  const canManageModerators = group.data.capabilities.includes(
    "GROUP_MANAGE_MODERATORS",
  );
  const canManageGuests = group.data.capabilities.includes(
    "GROUP_MANAGE_GUESTS",
  );
  const canManageGuestPolicy = group.data.capabilities.includes(
    "GROUP_MANAGE_GUEST_POLICY",
  );

  async function submitRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await command.mutateAsync({
      title: "Cambiar nombre",
      message: "",
      confirmLabel: "Guardar",
      run: async () => {
        await api.updateGroup(groupId, { name: name || currentGroupName });
        setName("");
      },
    });
  }

  return (
    <main className={styles.page}>
      <Link className={styles.back} href={`/groups/${groupId}`}>
        ← VOLVER AL GRUPO
      </Link>
      <header className={styles.hero}>
        <div>
          <Text tone="accent" variant="label">
            CONFIGURACIÓN · {group.data.status}
          </Text>
          <Text as="h1" variant="display-lg">
            {group.data.name}
          </Text>
          <Text tone="muted">
            Operaciones del vestuario según tu rol y permisos actuales.
          </Text>
        </div>
      </header>

      {isArchived && (
        <section className={styles.notice}>
          <strong>GRUPO ARCHIVADO</strong>
          <span>
            La historia sigue visible, pero las operaciones activas están
            cerradas.
          </span>
        </section>
      )}

      <section className={styles.section}>
        <SectionHeading eyebrow="IDENTIDAD" title="Nombre deportivo" />
        {isOwner && !isArchived ? (
          <form
            className={styles.inlineForm}
            onSubmit={(event) => void submitRename(event)}
          >
            <label>
              <span>Nombre del grupo</span>
              <input
                maxLength={100}
                onChange={(event) => setName(event.target.value)}
                placeholder={group.data.name}
                value={name}
              />
            </label>
            <Button
              disabled={command.isPending || name.trim().length === 0}
              type="submit"
            >
              Guardar nombre
            </Button>
          </form>
        ) : (
          <p className={styles.muted}>Sólo el owner puede cambiar el nombre.</p>
        )}
      </section>

      {isOwner ? (
        <section className={styles.section}>
          <SectionHeading eyebrow="VISIBILIDAD" title="Discovery del grupo" />
          <p className={styles.muted}>
            Público permite que el nombre aparezca en búsqueda y actividad
            destacada. Privado no cambia membresías, partidos ni permisos.
          </p>
          <div className={styles.actions}>
            <Button
              disabled={command.isPending || group.data.visibility === "PUBLIC"}
              onClick={() =>
                void command.mutateAsync({
                  title: "Visibilidad pública",
                  message: "",
                  confirmLabel: "Guardar",
                  run: async () => {
                    await api.updateGroupPrivacy(groupId, {
                      visibility: "PUBLIC",
                    });
                  },
                })
              }
            >
              Público
            </Button>
            <Button
              disabled={
                command.isPending || group.data.visibility === "PRIVATE"
              }
              onClick={() =>
                void command.mutateAsync({
                  title: "Visibilidad privada",
                  message: "",
                  confirmLabel: "Guardar",
                  run: async () => {
                    await api.updateGroupPrivacy(groupId, {
                      visibility: "PRIVATE",
                    });
                  },
                })
              }
              variant="secondary"
            >
              Privado
            </Button>
          </div>
        </section>
      ) : null}

      <section className={styles.section}>
        <SectionHeading eyebrow="EQUIPO" title="Miembros y autoridad" />
        <div className={styles.rows}>
          {activeMembers.map((member) => (
            <article className={styles.row} key={member.id}>
              <div>
                <strong>{member.player.displayName}</strong>
                <small>{member.role}</small>
              </div>
              {!isArchived && member.player.id !== me.data.id && (
                <div className={styles.actions}>
                  {canManageModerators && member.role === "MEMBER" && (
                    <Button
                      onClick={() =>
                        setConfirm({
                          title: "Promover a moderador",
                          message: `${member.player.displayName} podrá administrar miembros con los permisos iniciales del rol.`,
                          confirmLabel: "Promover",
                          run: () =>
                            api.promoteGroupMember(groupId, member.player.id),
                        })
                      }
                      variant="secondary"
                    >
                      Hacer moderador
                    </Button>
                  )}
                  {canManageModerators && member.role === "MODERATOR" && (
                    <Button
                      onClick={() =>
                        setConfirm({
                          title: "Quitar moderación",
                          message: `${member.player.displayName} volverá a ser miembro sin permisos delegados.`,
                          confirmLabel: "Quitar rol",
                          run: () =>
                            api.demoteGroupMember(groupId, member.player.id),
                        })
                      }
                      variant="secondary"
                    >
                      Quitar moderador
                    </Button>
                  )}
                  {canManageMembers && member.role !== "OWNER" && (
                    <Button
                      onClick={() =>
                        setConfirm({
                          title: "Remover miembro",
                          message: `${member.player.displayName} saldrá del grupo. Su historia deportiva no se elimina.`,
                          confirmLabel: "Remover",
                          run: () =>
                            api.removeGroupMember(groupId, member.player.id),
                        })
                      }
                      variant="secondary"
                    >
                      Remover
                    </Button>
                  )}
                  {isOwner && member.role !== "OWNER" && (
                    <Button
                      onClick={() =>
                        setConfirm({
                          title: "Bloquear en este grupo",
                          message: `${member.player.displayName} no podrá volver a ingresar ni recibir invitaciones para este grupo.`,
                          confirmLabel: "Bloquear",
                          run: () =>
                            api.blockGroupMember(groupId, member.player.id),
                        })
                      }
                      variant="secondary"
                    >
                      Bloquear
                    </Button>
                  )}
                </div>
              )}
              {isOwner && member.role === "MODERATOR" && !isArchived && (
                <CapabilityEditor
                  initial={member.capabilities}
                  onSave={(capabilities) =>
                    command.mutate({
                      title: "Actualizar permisos",
                      message: "",
                      confirmLabel: "Guardar",
                      run: () =>
                        api.updateModeratorCapabilities(
                          groupId,
                          member.player.id,
                          {
                            capabilities,
                          },
                        ),
                    })
                  }
                />
              )}
            </article>
          ))}
        </div>
        {isOwner && blockedMembers.length > 0 && (
          <div className={styles.subsection}>
            <h3>BLOQUEADOS EN ESTE GRUPO</h3>
            {blockedMembers.map((member) => (
              <div className={styles.row} key={member.id}>
                <div>
                  <strong>{member.player.displayName}</strong>
                  <small>BLOCKED</small>
                </div>
                <Button
                  onClick={() =>
                    setConfirm({
                      title: "Desbloquear miembro",
                      message:
                        "Desbloquear no lo reincorpora: sólo permite futuras invitaciones o reingresos.",
                      confirmLabel: "Desbloquear",
                      run: () =>
                        api.unblockGroupMember(groupId, member.player.id),
                    })
                  }
                  variant="secondary"
                >
                  Desbloquear
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {isOwner && !isArchived && (
        <section className={styles.section}>
          <SectionHeading eyebrow="PROPIEDAD" title="Transferir el grupo" />
          <p className={styles.muted}>
            La transferencia es atómica. Vos pasarás a ser miembro.
          </p>
          <div className={styles.actions}>
            {activeMembers
              .filter((member) => member.player.id !== me.data.id)
              .map((member) => (
                <Button
                  key={member.id}
                  onClick={() =>
                    setConfirm({
                      title: "Transferir ownership",
                      message: `${member.player.displayName} será el único owner y vos quedarás como miembro.`,
                      confirmLabel: "Transferir",
                      run: () =>
                        api.transferGroupOwnership(groupId, member.player.id),
                    })
                  }
                  variant="secondary"
                >
                  Transferir a {member.player.displayName}
                </Button>
              ))}
          </div>
        </section>
      )}

      {canManageInvitations && !isArchived && (
        <section className={styles.section}>
          <SectionHeading eyebrow="INVITACIONES" title="Accesos emitidos" />
          <InvitationRows
            directed={directedInvitations.data ?? []}
            loading={invitations.isPending || directedInvitations.isPending}
            tokens={invitations.data ?? []}
            onRevokeDirected={(id, name) =>
              setConfirm({
                title: "Revocar invitación dirigida",
                message: `${name} ya no podrá aceptar esta invitación.`,
                confirmLabel: "Revocar",
                run: () => api.revokeDirectedGroupInvitation(groupId, id),
              })
            }
            onRevokeToken={(id) =>
              setConfirm({
                title: "Revocar enlace",
                message: "El enlace dejará de admitir nuevos miembros.",
                confirmLabel: "Revocar",
                run: () => api.revokeInvitation(groupId, id),
              })
            }
          />
          {(invitations.isError || directedInvitations.isError) && (
            <p className={styles.error} role="alert">
              {invitations.error?.message ?? directedInvitations.error?.message}
            </p>
          )}
          <Link
            className="ui-button ui-button--secondary"
            href={`/groups/${groupId}`}
          >
            Crear o compartir invitación
          </Link>
        </section>
      )}

      {canReadGuests && (guests.isPending || guestPolicy.isPending) && (
        <section className={styles.section}>
          <SectionHeading eyebrow="INVITADOS" title="Directorio del grupo" />
          <p className={styles.muted} role="status">
            Cargando invitados…
          </p>
        </section>
      )}
      {canReadGuests && (guests.isError || guestPolicy.isError) && (
        <section className={styles.section}>
          <SectionHeading eyebrow="INVITADOS" title="Directorio del grupo" />
          <p className={styles.error} role="alert">
            {guests.error?.message ?? guestPolicy.error?.message}
          </p>
        </section>
      )}

      {canReadGuests && guests.data && guestPolicy.data && (
        <section className={styles.section}>
          <SectionHeading eyebrow="INVITADOS" title="Directorio del grupo" />
          {canManageGuestPolicy && (
            <label className={styles.toggle}>
              <input
                checked={guestPolicy.data.guestsEnabled}
                disabled={command.isPending}
                onChange={(event) =>
                  command.mutate({
                    title: "Política de invitados",
                    message: "",
                    confirmLabel: "Guardar",
                    run: () =>
                      api.updateGuestPolicy(groupId, {
                        guestsEnabled: event.target.checked,
                      }),
                  })
                }
                type="checkbox"
              />
              Permitir invitados persistentes en el grupo
            </label>
          )}
          <form
            className={styles.inlineForm}
            onSubmit={(event) => {
              event.preventDefault();
              command.mutate({
                title: "Crear invitado",
                message: "",
                confirmLabel: "Crear",
                run: async () => {
                  await api.createGroupGuest(groupId, newGuestName);
                  setNewGuestName("");
                },
              });
            }}
          >
            <label>
              <span>Nuevo invitado</span>
              <input
                maxLength={100}
                onChange={(event) => setNewGuestName(event.target.value)}
                value={newGuestName}
              />
            </label>
            <Button
              disabled={!newGuestName.trim() || command.isPending}
              type="submit"
            >
              Agregar
            </Button>
          </form>
          <div className={styles.rows}>
            {guests.data.map((guest) => (
              <GuestRow
                canManage={canManageGuests}
                guest={guest}
                key={guest.id}
                onArchive={() =>
                  setConfirm({
                    title: "Archivar invitado",
                    message:
                      "Seguirá en el historial, pero no estará disponible para nuevas convocatorias.",
                    confirmLabel: "Archivar",
                    run: () => api.archiveGroupGuest(groupId, guest.id),
                  })
                }
                onRemove={() =>
                  setConfirm({
                    title: "Quitar invitado",
                    message:
                      "Se conserva la evidencia de sus partidos anteriores.",
                    confirmLabel: "Quitar",
                    run: () => api.removeGroupGuest(groupId, guest.id),
                  })
                }
                onRename={(displayName) =>
                  command.mutate({
                    title: "Renombrar invitado",
                    message: "",
                    confirmLabel: "Guardar",
                    run: () =>
                      api.renameGroupGuest(groupId, guest.id, displayName),
                  })
                }
                onRestore={() =>
                  command.mutate({
                    title: "Restaurar invitado",
                    message: "",
                    confirmLabel: "Restaurar",
                    run: () => api.restoreGroupGuest(groupId, guest.id),
                  })
                }
              />
            ))}
          </div>
        </section>
      )}

      {!isArchived && (
        <section className={`${styles.section} ${styles.danger}`}>
          <SectionHeading eyebrow="ZONA DE RIESGO" title="Cerrar una etapa" />
          <div className={styles.actions}>
            <Button
              onClick={() =>
                setConfirm({
                  title: "Salir del grupo",
                  message: isOwner
                    ? "El dominio elegirá sucesor entre moderadores y miembros. Si sos el único miembro, el grupo se archivará."
                    : "Tu membership terminará, pero tu historia deportiva se conserva.",
                  confirmLabel: "Salir",
                  run: () => api.leaveGroup(groupId),
                  leaveAfter: true,
                })
              }
              variant="secondary"
            >
              Salir del grupo
            </Button>
            {group.data.capabilities.includes("GROUP_ARCHIVE") && (
              <Button
                onClick={() =>
                  setConfirm({
                    title: "Archivar grupo",
                    message:
                      "No se borrará la historia. Debés resolver antes todos los partidos Draft, Open o Started.",
                    confirmLabel: "Archivar",
                    run: () => api.archiveGroup(groupId),
                  })
                }
              >
                Archivar grupo
              </Button>
            )}
          </div>
        </section>
      )}

      {command.isError && (
        <p className={styles.error} role="alert">
          {command.error.message}
        </p>
      )}
      <ConfirmDialog
        confirmDisabled={command.isPending}
        confirmLabel={confirm?.confirmLabel ?? "Confirmar"}
        message={confirm?.message ?? ""}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && command.mutate(confirm)}
        open={Boolean(confirm)}
        title={confirm?.title ?? "Confirmar"}
      />
    </main>
  );
}

function SectionHeading({
  eyebrow,
  title,
}: Readonly<{ eyebrow: string; title: string }>) {
  return (
    <header className={styles.heading}>
      <Text tone="accent" variant="label">
        {eyebrow}
      </Text>
      <Text as="h2" variant="heading-lg">
        {title}
      </Text>
    </header>
  );
}

function CapabilityEditor({
  initial,
  onSave,
}: Readonly<{
  initial: Capability[];
  onSave: (values: Capability[]) => void;
}>) {
  const [values, setValues] = useState<Capability[]>(
    initial.filter((value) => value !== "GROUP_READ"),
  );
  return (
    <details className={styles.capabilities}>
      <summary>Permisos delegados</summary>
      <div className={styles.checks}>
        {configurableCapabilities.map((capability) => (
          <label key={capability}>
            <input
              checked={values.includes(capability)}
              onChange={(event) =>
                setValues((current) =>
                  event.target.checked
                    ? [...current, capability]
                    : current.filter((value) => value !== capability),
                )
              }
              type="checkbox"
            />
            {capabilityLabels[capability]}
          </label>
        ))}
      </div>
      <Button onClick={() => onSave(values)} variant="secondary">
        Guardar permisos
      </Button>
    </details>
  );
}

function InvitationRows({
  directed,
  loading,
  onRevokeDirected,
  onRevokeToken,
  tokens,
}: Readonly<{
  directed: Array<{
    id: string;
    status: string;
    invitedPlayer: { displayName: string };
    createdAt: string;
  }>;
  loading: boolean;
  onRevokeDirected: (id: string, name: string) => void;
  onRevokeToken: (id: string) => void;
  tokens: Array<{
    id: string;
    status: string;
    type: string;
    useCount: number;
    createdByDisplayName: string;
  }>;
}>) {
  if (loading) return <p className={styles.muted}>Cargando invitaciones…</p>;
  if (tokens.length === 0 && directed.length === 0)
    return <p className={styles.muted}>No hay invitaciones emitidas.</p>;
  return (
    <div className={styles.rows}>
      {tokens.map((item) => (
        <div className={styles.row} key={item.id}>
          <div>
            <strong>ENLACE · {item.type}</strong>
            <small>
              {item.status} · {item.useCount} usos · por{" "}
              {item.createdByDisplayName}
            </small>
          </div>
          {item.status === "ACTIVE" && (
            <Button onClick={() => onRevokeToken(item.id)} variant="secondary">
              Revocar
            </Button>
          )}
        </div>
      ))}
      {directed.map((item) => (
        <div className={styles.row} key={item.id}>
          <div>
            <strong>{item.invitedPlayer.displayName}</strong>
            <small>DIRIGIDA · {item.status}</small>
          </div>
          {item.status === "PENDING" && (
            <Button
              onClick={() =>
                onRevokeDirected(item.id, item.invitedPlayer.displayName)
              }
              variant="secondary"
            >
              Revocar
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

function GuestRow({
  canManage,
  guest,
  onArchive,
  onRemove,
  onRename,
  onRestore,
}: Readonly<{
  canManage: boolean;
  guest: {
    id: string;
    displayName: string;
    status: string;
    matchesPlayed: number;
  };
  onArchive: () => void;
  onRemove: () => void;
  onRename: (displayName: string) => void;
  onRestore: () => void;
}>) {
  const [displayName, setDisplayName] = useState(guest.displayName);
  return (
    <div className={styles.row}>
      <div>
        <strong>{guest.displayName}</strong>
        <small>
          {guest.status} · {guest.matchesPlayed} partidos
        </small>
      </div>
      {canManage && guest.status !== "DELETED" && (
        <div className={styles.guestControls}>
          <label>
            <span className={styles.srOnly}>Nombre del invitado</span>
            <input
              maxLength={100}
              onChange={(event) => setDisplayName(event.target.value)}
              value={displayName}
            />
          </label>
          <Button
            disabled={!displayName.trim() || displayName === guest.displayName}
            onClick={() => onRename(displayName)}
            variant="secondary"
          >
            Renombrar
          </Button>
          {guest.status === "ACTIVE" ? (
            <Button onClick={onArchive} variant="secondary">
              Archivar
            </Button>
          ) : (
            <Button onClick={onRestore} variant="secondary">
              Restaurar
            </Button>
          )}
          <Button onClick={onRemove} variant="secondary">
            Quitar
          </Button>
        </div>
      )}
    </div>
  );
}

async function invalidateGroupManagement(
  queryClient: ReturnType<typeof useQueryClient>,
  groupId: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.groups }),
    queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) }),
    queryClient.invalidateQueries({
      queryKey: ["groups", groupId, "members"],
    }),
    queryClient.invalidateQueries({ queryKey: queryKeys.invitations(groupId) }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.managedDirectedGroupInvitations(groupId),
    }),
    queryClient.invalidateQueries({ queryKey: queryKeys.groupGuests(groupId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.guestPolicy(groupId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.matches(groupId) }),
    queryClient.invalidateQueries({ queryKey: ["search"] }),
    queryClient.invalidateQueries({ queryKey: ["discovery", "groups"] }),
  ]);
}
