"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { OverallDisplay, TacticalDivider } from "@football/football-ui";
import { Badge, Text } from "@football/ui";

import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";
import { CareerMarks } from "./career-marks";
import { ProfilePlayerCard } from "./profile-player-card";
import styles from "./profile.module.css";

export function ProfileScreen() {
  const profile = useQuery({
    queryKey: queryKeys.ownProfile,
    queryFn: api.ownProfile,
  });

  if (profile.isPending)
    return (
      <div className={styles.page} role="status">
        Preparando tu perfil F5…
      </div>
    );
  if (profile.isError)
    return (
      <div className={styles.page} role="alert">
        No pudimos cargar tu perfil F5.
      </div>
    );

  const data = profile.data;
  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <Text as="span" tone="accent" variant="label">
          MI IDENTIDAD · F5
        </Text>
        <Text as="h1" variant="display-lg">
          {data.player.displayName}
        </Text>
        <Text tone="muted">Tu identidad futbolística y tu evolución.</Text>
      </header>

      <div className={styles.profileLayout}>
        <aside className={styles.identity}>
          <ProfilePlayerCard
            image={data.player.image}
            name={data.player.displayName}
            performance={data.performance}
          />
        </aside>

        <main className={styles.profileContent}>
          <section className={styles.panelSection}>
            <div className={styles.profileSummary}>
              <div>
                <Text as="h2" variant="heading-lg">
                  Perfil futbolístico
                </Text>
                <Text tone="accent" variant="label">
                  {data.footballProfile?.preferredRoles.join(" · ") ||
                    "SIN ROLES CONFIGURADOS"}
                </Text>
                <Text tone="muted">
                  {data.footballProfile
                    ? `${data.footballProfile.strengths.join(" · ") || "Sin fortalezas declaradas"}${data.footballProfile.willingToPlayGoalkeeper ? " · Puede atajar" : ""}`
                    : "Completá tus preferencias para definir tu perfil F5."}
                </Text>
              </div>
              <OverallDisplay value={Math.round(data.performance.overall)} />
            </div>
          </section>

          <TacticalDivider />
          <section className={styles.panelSection}>
            <Text as="h2" variant="heading-lg">
              Tu carrera
            </Text>
            <dl className={styles.careerMetrics}>
              <Metric
                label="Partidos"
                value={data.performance.processedMatchCount}
              />
              <Metric
                label="Promedio"
                value={formatRating(data.summary.averageRating)}
              />
              <Metric label="Goles" value={data.summary.totalGoals} />
              <Metric label="Asistencias" value={data.summary.totalAssists} />
            </dl>
          </section>

          <TacticalDivider />
          <section className={styles.panelSection}>
            <div className={styles.sectionHeading}>
              <div>
                <Text as="h2" variant="heading-lg">
                  Tu progreso
                </Text>
                <Text tone="muted">
                  Revisá cómo cambió tu OVR partido a partido.
                </Text>
              </div>
            </div>
            <Link
              className="ui-button ui-button--secondary"
              href="/profile/progression"
            >
              Ver historial de progreso
            </Link>
          </section>

          <TacticalDivider />
          <CareerMarks rewards={data.rewards} />

          <TacticalDivider />
          <section className={styles.panelSection}>
            <Text as="h2" variant="heading-lg">
              Tus grupos
            </Text>
            <ul className={styles.linkList}>
              {data.groups.map((group) => (
                <li key={group.id}>
                  <Link href={`/groups/${group.id}`}>{group.name}</Link>
                  {group.visibility === "PRIVATE" ? (
                    <Badge kind="state">PRIVADO</Badge>
                  ) : null}
                  <span aria-hidden="true" className={styles.rowArrow}>
                    →
                  </span>
                </li>
              ))}
              {data.groups.length === 0 ? (
                <li>
                  <Text tone="muted">
                    Todavía no pertenecés a ningún grupo.
                  </Text>
                </li>
              ) : null}
            </ul>
            <Link className="ui-button ui-button--secondary" href="/groups">
              Ver grupos
            </Link>
          </section>

          <TacticalDivider />
          <section className={styles.panelSection}>
            <Text as="h2" variant="heading-lg">
              Tu red
            </Text>
            <div className={styles.inlineActions}>
              <Link
                className="ui-button ui-button--secondary"
                href="/connections"
              >
                Conexiones
              </Link>
              <Link
                className="ui-button ui-button--secondary"
                href="/invitations"
              >
                Invitaciones
              </Link>
            </div>
          </section>

          <TacticalDivider />
          <section className={styles.panelSection}>
            <Text as="h2" variant="heading-lg">
              Configuración
            </Text>
            <Text tone="muted">
              Identidad, preferencias, privacidad y seguridad viven fuera de tu
              carrera deportiva.
            </Text>
            <Link
              className="ui-button ui-button--management"
              href="/profile/settings"
            >
              Configuración
            </Link>
          </section>
        </main>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
}: Readonly<{ label: string; value: string | number }>) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function formatRating(value: string | null) {
  return value === null ? "—" : Number(value).toFixed(1);
}
