"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Fragment, useState, type ReactNode } from "react";

import { adminApi } from "../lib/api";
import { ConfirmAction } from "./confirm-action";

type ResourceKind = "players" | "groups" | "matches";
type Data = Record<string, unknown>;
interface PendingAction {
  title: string;
  consequence: string;
  path: string;
  body?: Record<string, string>;
}

export function ResourceScreen({
  kind,
  id,
}: Readonly<{ kind: ResourceKind; id: string }>) {
  const client = useQueryClient();
  const [reason, setReason] = useState("");
  const [name, setName] = useState("");
  const [confirmation, setConfirmation] = useState<PendingAction | null>(null);
  const resource = useQuery({
    queryKey: ["admin", kind, id],
    queryFn: () => adminApi<Data>(`/admin/${kind}/${id}`),
  });
  const action = useMutation({
    mutationFn: (pending: PendingAction) =>
      adminApi<void>(pending.path, {
        method: "POST",
        body: JSON.stringify({ reason, ...pending.body }),
      }),
    onSuccess: async () => {
      setReason("");
      setName("");
      setConfirmation(null);
      await client.invalidateQueries({ queryKey: ["admin"] });
    },
  });
  if (resource.isPending)
    return (
      <main>
        <p className="muted">Cargando recurso…</p>
      </main>
    );
  if (resource.isError)
    return (
      <main>
        <h1>No disponible</h1>
        <p className="error">No pudimos abrir este recurso.</p>
      </main>
    );
  const data = resource.data;
  const title = text(
    data,
    kind === "players"
      ? "displayName"
      : kind === "groups"
        ? "name"
        : "groupName",
  );
  return (
    <main>
      <header className="page-header">
        <Link className="button-link button-quiet" href={`/${kind}`}>
          ← Volver
        </Link>
        <span className="eyebrow">
          {kind === "players"
            ? "JUGADOR"
            : kind === "groups"
              ? "GRUPO"
              : "PARTIDO"}
        </span>
        <h1>{title}</h1>
        <div className="entity-id">
          <span className="mono">{id}</span>
          <button
            className="button-quiet"
            onClick={() => void navigator.clipboard.writeText(id)}
          >
            Copiar ID
          </button>
        </div>
      </header>
      {kind === "players" ? (
        <PlayerDetail data={data} />
      ) : kind === "groups" ? (
        <GroupDetail
          data={data}
          onAction={setConfirmation}
          enabled={reason.trim().length >= 5}
        />
      ) : (
        <MatchDetail
          data={data}
          onAction={setConfirmation}
          enabled={reason.trim().length >= 5}
        />
      )}
      <section className="risk-zone" aria-labelledby="admin-actions">
        <div className="section-stack">
          <span className="eyebrow">ACCIONES AUDITADAS</span>
          <h2 id="admin-actions">Moderación</h2>
          <p className="muted">
            Toda acción requiere un motivo y queda registrada en Auditoría.
          </p>
        </div>
        <label className="field">
          Motivo
          <input
            value={reason}
            minLength={5}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        {kind !== "matches" ? (
          <label className="field">
            Nombre corregido
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
        ) : null}
        <div className="actions">
          {kind === "players" ? (
            <PlayerActions
              data={data}
              enabled={reason.trim().length >= 5}
              name={name}
              request={setConfirmation}
              id={id}
            />
          ) : null}
          {kind === "groups" ? (
            <GroupActions
              data={data}
              enabled={reason.trim().length >= 5}
              name={name}
              request={setConfirmation}
              id={id}
            />
          ) : null}
          {kind === "matches" ? (
            <MatchActions
              data={data}
              enabled={reason.trim().length >= 5}
              request={setConfirmation}
              id={id}
            />
          ) : null}
        </div>
        {action.isError ? (
          <p className="error" role="alert">
            La operación fue rechazada o el estado cambió. Revisá el recurso.
          </p>
        ) : null}
        {action.isSuccess ? (
          <p className="success" role="status">
            Acción registrada en Auditoría.
          </p>
        ) : null}
      </section>
      {confirmation ? (
        <ConfirmAction
          title={confirmation.title}
          consequence={confirmation.consequence}
          pending={action.isPending}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => action.mutate(confirmation)}
        />
      ) : null}
    </main>
  );
}

function PlayerDetail({ data }: Readonly<{ data: Data }>) {
  const groups = array(data.groups);
  return (
    <div className="detail-grid">
      <Section title="Identidad">
        <Facts
          rows={[
            ["Nombre", text(data, "displayName")],
            ["Visibilidad", label(text(data, "profileVisibility"))],
            ["Estado", label(text(data, "accountStatus"))],
            ["Creado", date(data.createdAt)],
          ]}
        />
      </Section>
      <Section title="Cuenta">
        <Facts
          rows={[
            ["Email", text(data, "email") || "Cuenta desvinculada"],
            ["Email verificado", data.emailVerified ? "Sí" : "No"],
            ["Suspensión", data.suspended ? "Suspendida" : "Activa"],
            ["Reportes abiertos", number(data, "openReportCount", "0")],
          ]}
        />
      </Section>
      <Section title="Grupos">
        <ul className="compact-list">
          {groups.map((item) => (
            <li key={text(item, "id")}>
              <Link href={`/groups/${text(item, "id")}`}>
                {text(item, "name")}
              </Link>
              <span className="metadata">{label(text(item, "role"))}</span>
            </li>
          ))}
        </ul>
        {groups.length === 0 ? (
          <p className="empty">No tiene membresías activas.</p>
        ) : null}
      </Section>
      <Section title="Moderación">
        <p className="muted">
          Las operaciones disponibles dependen del estado actual de la cuenta.
        </p>
      </Section>
    </div>
  );
}

function GroupDetail({
  data,
  onAction,
  enabled,
}: Readonly<{
  data: Data;
  onAction: (value: PendingAction) => void;
  enabled: boolean;
}>) {
  const members = array(data.members);
  const matches = array(data.recentMatches);
  const invitations = array(data.invitations);
  return (
    <div className="detail-grid">
      <Section title="Estado">
        <Facts
          rows={[
            ["Estado", label(text(data, "status"))],
            ["Visibilidad", label(text(data, "visibility"))],
            ["Propietario", text(data, "ownerName") || "No disponible"],
            ["Miembros", number(data, "memberCount", "0")],
            ["Partidos activos", number(data, "activeMatches", "0")],
          ]}
        />
      </Section>
      <Section title="Miembros">
        <ul className="compact-list">
          {members.map((item) => (
            <li key={text(item, "id")}>
              <Link href={`/players/${text(item, "id")}`}>
                {text(item, "displayName")}
              </Link>
              <span className="metadata">{label(text(item, "role"))}</span>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Partidos recientes">
        <ul className="compact-list">
          {matches.map((item) => (
            <li key={text(item, "id")}>
              <Link href={`/matches/${text(item, "id")}`}>
                {date(item.scheduledAt)}
              </Link>
              <span className="metadata">{label(text(item, "status"))}</span>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Invitaciones activas">
        <ul className="compact-list">
          {invitations.map((item) => (
            <li key={text(item, "id")}>
              <span>
                {text(item, "invitedPlayerName") || label(text(item, "type"))}
              </span>
              <button
                className="button-quiet"
                disabled={!enabled}
                onClick={() =>
                  onAction({
                    title: "Revocar invitación",
                    consequence:
                      "La invitación dejará de ser utilizable y la acción quedará auditada.",
                    path: `/admin/invitations/${text(item, "id")}/revoke`,
                    body: { kind: text(item, "kind") },
                  })
                }
              >
                Revocar
              </button>
            </li>
          ))}
        </ul>
        {invitations.length === 0 ? (
          <p className="empty">No hay invitaciones activas.</p>
        ) : null}
      </Section>
    </div>
  );
}

function MatchDetail({
  data,
  onAction,
  enabled,
}: Readonly<{
  data: Data;
  onAction: (value: PendingAction) => void;
  enabled: boolean;
}>) {
  const participants = array(data.participants);
  const teams = array(data.teams);
  const ballots = array(data.ballots);
  const invitations = array(data.invitations);
  const result = record(data.result);
  return (
    <div className="detail-grid">
      <Section title="Partido">
        <Facts
          rows={[
            ["Estado", label(text(data, "status"))],
            ["Fecha", date(data.scheduledAt)],
            ["Sede", text(data, "locationText")],
            ["Cupo", number(data, "capacity")],
            [
              "Progresión",
              data.progressionMaterialized ? "Materializada" : "Pendiente",
            ],
          ]}
        />
      </Section>
      <Section title="Resultado">
        <Facts
          rows={[
            ["Equipo A", result ? number(result, "teamAGoals") : "—"],
            ["Equipo B", result ? number(result, "teamBGoals") : "—"],
            ["Cierre editable", data.closureEditable ? "Sí" : "No"],
          ]}
        />
      </Section>
      <Section title="Plantel">
        <ul className="compact-list">
          {participants.map((item) => (
            <li key={text(item, "id")}>
              <span>
                {text(item, "displayName") || text(item, "guestDisplayName")}
              </span>
              <span className="metadata">
                {label(text(item, "status"))} ·{" "}
                {label(text(item, "attendance"))}
              </span>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Equipos">
        <p className="muted">{teams.length} asignaciones registradas.</p>
      </Section>
      <Section title="Boletas anulables">
        <ul className="compact-list">
          {ballots.map((item) => (
            <li key={text(item, "id")}>
              <span className="mono">{text(item, "id").slice(0, 8)}…</span>
              <button
                className="button-danger"
                disabled={!enabled}
                onClick={() =>
                  onAction({
                    title: "Anular boleta",
                    consequence:
                      "La boleta se excluirá antes de materializar la progresión. Esta acción no puede deshacerse desde la consola.",
                    path: `/admin/voting/ballots/${text(item, "id")}/void`,
                  })
                }
              >
                Anular
              </button>
            </li>
          ))}
        </ul>
        {ballots.length === 0 ? (
          <p className="empty">No hay boletas anulables.</p>
        ) : null}
      </Section>
      <Section title="Invitaciones activas">
        <ul className="compact-list">
          {invitations.map((item) => (
            <li key={text(item, "id")}>
              <span>{text(item, "invitedPlayerName")}</span>
              <button
                className="button-quiet"
                disabled={!enabled}
                onClick={() =>
                  onAction({
                    title: "Revocar invitación",
                    consequence:
                      "La invitación al partido dejará de estar disponible.",
                    path: `/admin/invitations/${text(item, "id")}/revoke`,
                    body: { kind: "MATCH_DIRECTED" },
                  })
                }
              >
                Revocar
              </button>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function PlayerActions({
  data,
  enabled,
  name,
  request,
  id,
}: Readonly<{
  data: Data;
  enabled: boolean;
  name: string;
  request: (value: PendingAction) => void;
  id: string;
}>) {
  const suspended = Boolean(data.suspended);
  return (
    <>
      {suspended ? (
        <button
          disabled={!enabled}
          onClick={() =>
            request({
              title: "Reactivar cuenta",
              consequence: "La cuenta recuperará acceso al producto.",
              path: `/admin/players/${id}/reactivate`,
            })
          }
        >
          Reactivar cuenta
        </button>
      ) : (
        <button
          className="button-danger"
          disabled={!enabled}
          onClick={() =>
            request({
              title: "Suspender cuenta",
              consequence:
                "Se cerrarán las sesiones activas y la cuenta perderá acceso.",
              path: `/admin/players/${id}/suspend`,
            })
          }
        >
          Suspender cuenta
        </button>
      )}
      <button
        disabled={!enabled || name.trim().length < 2}
        onClick={() =>
          request({
            title: "Moderar nombre",
            consequence:
              "La identidad pública se actualizará y la operación quedará auditada.",
            path: `/admin/players/${id}/moderate-name`,
            body: { displayName: name },
          })
        }
      >
        Moderar nombre
      </button>
      <button
        className="button-danger"
        disabled={!enabled}
        onClick={() =>
          request({
            title: "Quitar avatar",
            consequence:
              "El avatar actual dejará de mostrarse. La evidencia deportiva se conserva.",
            path: `/admin/players/${id}/remove-avatar`,
          })
        }
      >
        Quitar avatar
      </button>
    </>
  );
}
function GroupActions({
  data,
  enabled,
  name,
  request,
  id,
}: Readonly<{
  data: Data;
  enabled: boolean;
  name: string;
  request: (value: PendingAction) => void;
  id: string;
}>) {
  return (
    <>
      <button
        disabled={!enabled || text(data, "visibility") === "PRIVATE"}
        onClick={() =>
          request({
            title: "Forzar grupo privado",
            consequence: "El grupo dejará de estar visible públicamente.",
            path: `/admin/groups/${id}/force-private`,
          })
        }
      >
        Forzar privado
      </button>
      <button
        disabled={!enabled || name.trim().length < 2}
        onClick={() =>
          request({
            title: "Moderar nombre",
            consequence:
              "El nombre del grupo se reemplazará y la operación quedará auditada.",
            path: `/admin/groups/${id}/moderate-name`,
            body: { name },
          })
        }
      >
        Moderar nombre
      </button>
      <button
        className="button-danger"
        disabled={!enabled || text(data, "status") === "ARCHIVED"}
        onClick={() =>
          request({
            title: "Archivar grupo",
            consequence:
              "El grupo quedará histórico. Los partidos activos pueden impedir la acción.",
            path: `/admin/groups/${id}/archive`,
          })
        }
      >
        Archivar grupo
      </button>
    </>
  );
}
function MatchActions({
  data,
  enabled,
  request,
  id,
}: Readonly<{
  data: Data;
  enabled: boolean;
  request: (value: PendingAction) => void;
  id: string;
}>) {
  const cancellable = ["DRAFT", "OPEN"].includes(text(data, "status"));
  return (
    <button
      className="button-danger"
      disabled={!enabled || !cancellable}
      onClick={() =>
        request({
          title: "Cancelar partido",
          consequence:
            "El partido quedará cancelado y conservará su evidencia histórica.",
          path: `/admin/matches/${id}/cancel`,
        })
      }
    >
      Cancelar partido
    </button>
  );
}
function Section({
  title,
  children,
}: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <section className="detail-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
function Facts({ rows }: Readonly<{ rows: Array<[string, string]> }>) {
  return (
    <dl>
      {rows.map(([key, value]) => (
        <Fragment key={key}>
          <dt>{key}</dt>
          <dd>{value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}
function text(data: Data, key: string) {
  const value = data[key];
  return typeof value === "string" ? value : "";
}
function number(data: Data, key: string, fallback = "—") {
  const value = data[key];
  return typeof value === "number" ? String(value) : fallback;
}
function record(value: unknown): Data | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Data)
    : null;
}
function array(value: unknown): Data[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Data => Boolean(item) && typeof item === "object",
      )
    : [];
}
function date(value: unknown) {
  if (typeof value !== "string") return "No disponible";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    hourCycle: "h23",
  }).format(new Date(value));
}
function label(value: string) {
  return (
    (
      {
        ACTIVE: "ACTIVO",
        ANONYMIZED: "ANONIMIZADO",
        PUBLIC: "PÚBLICO",
        PRIVATE: "PRIVADO",
        ARCHIVED: "ARCHIVADO",
        OWNER: "PROPIETARIO",
        MODERATOR: "MODERADOR",
        MEMBER: "MIEMBRO",
        DRAFT: "BORRADOR",
        OPEN: "ABIERTO",
        STARTED: "EN JUEGO",
        FINISHED: "FINALIZADO",
        CANCELLED: "CANCELADO",
        CONFIRMED: "CONFIRMADO",
        WAITLISTED: "EN ESPERA",
        PLAYED: "JUGÓ",
        NO_SHOW: "AUSENTE",
        SINGLE_USE: "UN SOLO USO",
        TIME_LIMITED: "TIEMPO LIMITADO",
      } as Record<string, string>
    )[value] ??
    (value || "NO DISPONIBLE")
  );
}
