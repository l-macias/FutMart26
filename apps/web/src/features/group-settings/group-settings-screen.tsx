"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { Badge, Button, Text } from "@football/ui";
import type { MembershipResponse } from "@football/contracts";
import { ConfirmDialog } from "@/components/confirm-dialog/confirm-dialog";
import { InviteConnectionControl } from "@/features/directed-invitations/invite-connection-control";
import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";

import styles from "./group-settings.module.css";

type Command = {
  title: string;
  message: string;
  confirmLabel: string;
  run: () => Promise<void>;
  leaveAfter?: boolean;
  successMessage?: string;
  tone?: "default" | "danger";
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
const roleLabels: Record<MembershipResponse["role"], string> = {
  OWNER: "PROPIETARIO",
  MODERATOR: "MOD",
  MEMBER: "Miembro",
};

export function GroupSettingsScreen({
  groupId,
}: Readonly<{ groupId: string }>) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState<Command | null>(null);
  const [name, setName] = useState("");
  const [newGuestName, setNewGuestName] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [createdInvitationUrl, setCreatedInvitationUrl] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(null), 3_500);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

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
      setFeedback(item.successMessage ?? "Cambios guardados.");
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
    return <div className={styles.page}>Cargando configuración…</div>;
  if (group.isError || me.isError || members.isError)
    return (
      <div className={styles.page}>
        <p className={styles.error} role="alert">
          {group.error?.message ?? me.error?.message ?? members.error?.message}
        </p>
      </div>
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

  function submitRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    command.mutate({
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
    <div className={`${styles.page} ui-visual-v4`}>
      <Link className={styles.back} href={`/groups/${groupId}`}>
        ← VOLVER AL GRUPO
      </Link>
      <header className={styles.header}>
        <div>
          <Text tone="accent" variant="label">
            GRUPO
          </Text>
          <Text as="h1" variant="heading-lg">
            Configuración del grupo
          </Text>
          <Text as="h2" className={styles.groupName} variant="heading-md">
            {group.data.name}
          </Text>
          <div className={styles.headerMeta}>
            {group.data.role !== "MEMBER" ? (
              <Badge kind="role">{roleLabels[group.data.role]}</Badge>
            ) : null}
            {group.data.visibility === "PRIVATE" ? (
              <Badge kind="state">PRIVADO</Badge>
            ) : null}
            {isArchived ? <Badge kind="state">ARCHIVADO</Badge> : null}
          </div>
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

      <SettingsSection
        defaultOpen
        eyebrow="GENERAL"
        summary={`${group.data.name} · ${group.data.visibility === "PUBLIC" ? "Público" : "Privado"}`}
        title="Identidad y privacidad"
      >
        {isOwner && !isArchived ? (
          <>
            <form className={styles.inlineForm} onSubmit={submitRename}>
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
            <div className={styles.subsection}>
              <h3>VISIBILIDAD</h3>
              <p className={styles.muted}>
                Público permite aparecer en búsqueda. Privado conserva miembros,
                partidos y permisos, pero deja de aparecer allí.
              </p>
              <div className={styles.actions}>
                <Button
                  disabled={
                    command.isPending || group.data.visibility === "PUBLIC"
                  }
                  onClick={() =>
                    command.mutate({
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
                    command.mutate({
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
            </div>
          </>
        ) : (
          <p className={styles.muted}>
            El grupo es{" "}
            {group.data.visibility === "PUBLIC" ? "público" : "privado"}. Sólo
            el propietario puede cambiar su identidad y privacidad.
          </p>
        )}
      </SettingsSection>

      <SettingsSection
        eyebrow="MIEMBROS"
        summary={`${activeMembers.length} miembros · roles y permisos delegados`}
        title="Plantel y autoridad"
      >
        <div className={`${styles.rows} ui-list`}>
          {activeMembers.map((member) => (
            <article className={`${styles.row} ui-row`} key={member.id}>
              <div>
                <strong>{member.player.displayName}</strong>
                {member.role !== "MEMBER" ? (
                  <Badge kind="role">{roleLabels[member.role]}</Badge>
                ) : (
                  <small>{roleLabels[member.role]}</small>
                )}
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
                          successMessage: "Moderador actualizado.",
                        })
                      }
                      variant="management"
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
                          successMessage: "Rol de moderador actualizado.",
                        })
                      }
                      variant="management"
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
                          tone: "danger",
                        })
                      }
                      variant="danger"
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
                          tone: "danger",
                        })
                      }
                      variant="danger"
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
                      successMessage: "Permisos guardados.",
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
                  <small>BLOQUEADO</small>
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
      </SettingsSection>

      {canManageInvitations && !isArchived && (
        <SettingsSection
          eyebrow="INVITACIONES"
          summary="Jugadores, conexiones y enlaces activos"
          title="Invitar al grupo"
        >
          <div className={styles.actions}>
            <InviteConnectionControl destinationId={groupId} kind="group" />
            <Button
              disabled={command.isPending}
              onClick={() =>
                command.mutate({
                  title: "Crear enlace",
                  message: "",
                  confirmLabel: "Crear",
                  run: async () => {
                    const created = await api.createInvitation(groupId, {
                      type: "SINGLE_USE",
                    });
                    setCreatedInvitationUrl(
                      `${window.location.origin}/invite/${created.token}`,
                    );
                  },
                  successMessage: "Enlace de invitación creado.",
                })
              }
              variant="secondary"
            >
              Crear enlace de un uso
            </Button>
          </div>
          {createdInvitationUrl ? (
            <div className={styles.invitationLink} role="status">
              <span>ENLACE LISTO</span>
              <input
                aria-label="Enlace de invitación creado"
                readOnly
                value={createdInvitationUrl}
              />
              <Button
                onClick={() => {
                  void navigator.clipboard
                    .writeText(createdInvitationUrl)
                    .then(() => setFeedback("Enlace copiado."))
                    .catch(() =>
                      setFeedback(
                        "No pudimos copiarlo automáticamente. Seleccioná el enlace.",
                      ),
                    );
                }}
                variant="quiet"
              >
                Copiar enlace
              </Button>
            </div>
          ) : null}
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
        </SettingsSection>
      )}

      {canReadGuests && (guests.isPending || guestPolicy.isPending) && (
        <SettingsSection
          eyebrow="INVITADOS"
          summary="Identidades reutilizables para partidos"
          title="Directorio del grupo"
        >
          <p className={styles.muted} role="status">
            Cargando invitados…
          </p>
        </SettingsSection>
      )}
      {canReadGuests && (guests.isError || guestPolicy.isError) && (
        <SettingsSection
          eyebrow="INVITADOS"
          summary="Identidades reutilizables para partidos"
          title="Directorio del grupo"
        >
          <p className={styles.error} role="alert">
            {guests.error?.message ?? guestPolicy.error?.message}
          </p>
        </SettingsSection>
      )}

      {canReadGuests && guests.data && guestPolicy.data && (
        <SettingsSection
          eyebrow="INVITADOS"
          summary={`${guests.data.filter((guest) => guest.status === "ACTIVE").length} activos · archivo reversible`}
          title="Directorio del grupo"
        >
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
          <div className={`${styles.rows} ui-list`}>
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
                    tone: "danger",
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
        </SettingsSection>
      )}

      {isOwner && !isArchived && (
        <SettingsSection
          eyebrow="PROPIEDAD"
          summary="Transferencia sensible y atómica"
          title="Propietario del grupo"
        >
          <p className={styles.muted}>
            Sos el propietario actual. Al transferir, la otra persona será la
            única propietaria y vos pasarás a ser miembro.
          </p>
          <div className={styles.actions}>
            {activeMembers
              .filter((member) => member.player.id !== me.data.id)
              .map((member) => (
                <Button
                  key={member.id}
                  onClick={() =>
                    setConfirm({
                      title: "Transferir propiedad",
                      message: `${member.player.displayName} será la única persona propietaria del grupo y vos quedarás como miembro.`,
                      confirmLabel: "Transferir propiedad",
                      run: () =>
                        api.transferGroupOwnership(groupId, member.player.id),
                      tone: "danger",
                    })
                  }
                  variant="danger"
                >
                  Transferir a {member.player.displayName}
                </Button>
              ))}
          </div>
        </SettingsSection>
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
                    ? "Se elegirá un sucesor entre moderadores y miembros. Si sos el único miembro, el grupo se archivará."
                    : "Dejarás de ser miembro, pero tu historia deportiva se conserva.",
                  confirmLabel: "Salir",
                  run: () => api.leaveGroup(groupId),
                  leaveAfter: true,
                  tone: "danger",
                })
              }
              variant="danger"
            >
              Salir del grupo
            </Button>
            {group.data.capabilities.includes("GROUP_ARCHIVE") && (
              <Button
                onClick={() =>
                  setConfirm({
                    title: "Archivar grupo",
                    message:
                      "No se borrará la historia. Debés resolver antes todos los partidos en borrador, abiertos o en juego.",
                    confirmLabel: "Archivar",
                    run: () => api.archiveGroup(groupId),
                    tone: "danger",
                  })
                }
                variant="danger"
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
      {feedback && !command.isError && (
        <p className={styles.feedback} role="status">
          {feedback}
        </p>
      )}
      <ConfirmDialog
        confirmDisabled={command.isPending}
        confirmLabel={confirm?.confirmLabel ?? "Confirmar"}
        message={confirm?.message ?? ""}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && command.mutate(confirm)}
        open={Boolean(confirm)}
        tone={confirm?.tone}
        title={confirm?.title ?? "Confirmar"}
      />
    </div>
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

function SettingsSection({
  children,
  defaultOpen = false,
  eyebrow,
  summary,
  title,
}: Readonly<{
  children: ReactNode;
  defaultOpen?: boolean;
  eyebrow: string;
  summary: string;
  title: string;
}>) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <details
      className={styles.settingsSection}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      open={isOpen}
    >
      <summary>
        <span>
          <Text tone="accent" variant="label">
            {eyebrow}
          </Text>
          <Text as="span" variant="heading-lg">
            {title}
          </Text>
        </span>
        <Text tone="muted" variant="metadata">
          {summary}
        </Text>
      </summary>
      <div className={styles.settingsContent}>{children}</div>
    </details>
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
  const activeTokens = tokens.filter((item) => item.status === "ACTIVE");
  const pendingDirected = directed.filter((item) => item.status === "PENDING");
  if (activeTokens.length === 0 && pendingDirected.length === 0)
    return (
      <p className={styles.muted}>
        Todavía no hay invitaciones pendientes ni enlaces activos.
      </p>
    );
  return (
    <div className={styles.rows}>
      {activeTokens.map((item) => (
        <div className={styles.row} key={item.id}>
          <div>
            <strong>
              ENLACE · {item.type === "SINGLE_USE" ? "UN USO" : "TEMPORAL"}
            </strong>
            <small>
              ACTIVO · {item.useCount} usos · creado por{" "}
              {item.createdByDisplayName}
            </small>
          </div>
          <Button onClick={() => onRevokeToken(item.id)} variant="secondary">
            Revocar
          </Button>
        </div>
      ))}
      {pendingDirected.map((item) => (
        <div className={styles.row} key={item.id}>
          <div>
            <strong>{item.invitedPlayer.displayName}</strong>
            <small>INVITACIÓN DIRECTA · PENDIENTE</small>
          </div>
          <Button
            onClick={() =>
              onRevokeDirected(item.id, item.invitedPlayer.displayName)
            }
            variant="secondary"
          >
            Revocar
          </Button>
        </div>
      ))}
    </div>
  );
}

function GuestRow({
  canManage,
  guest,
  onArchive,
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
  onRename: (displayName: string) => void;
  onRestore: () => void;
}>) {
  const [displayName, setDisplayName] = useState(guest.displayName);
  return (
    <div className={styles.row}>
      <div>
        <strong>{guest.displayName}</strong>
        <small>
          {guest.status === "ACTIVE" ? "ACTIVO" : "ARCHIVADO"} ·{" "}
          {guest.matchesPlayed} partidos
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
      queryKey: queryKeys.groupOverview(groupId),
    }),
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
