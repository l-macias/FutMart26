"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { Badge, Text } from "@football/ui";

import { OvrPlate } from "@/components/visual-v3/ovr-plate";
import { V4GroupCrest } from "@/components/visual-v4/profile-assets";
import { V4PlayIdentity } from "@/components/visual-v4/play-identity";
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
  const primaryGroup = data.groups[0] ?? null;
  return (
    <div className={`${styles.page} ui-visual-v3 ui-visual-v4`}>
      <section className={styles.identityStage} aria-labelledby="profile-name">
        <div className={styles.identityPitch} aria-hidden="true" />
        <div className={styles.identityIllustration} aria-hidden="true" />
        <span className={styles.profileSerial}>FIFAR / PLAYER IDENTITY</span>
        <aside className={styles.identityCard}>
          <ProfilePlayerCard
            image={data.player.image}
            name={data.player.displayName}
            performance={data.performance}
          />
        </aside>
        <header className={styles.pageHeader}>
          <span className={styles.identityBadge}>MI PERFIL · F5</span>
          <Text as="h1" id="profile-name" variant="display-lg">
            {data.player.displayName}
          </Text>
          <Text tone="muted">Tu carrera, tu forma de jugar, tu historia.</Text>
          <div className={styles.identityMeta}>
            <OvrPlate
              detail={data.performance.ratingProfile}
              size="large"
              value={Math.round(data.performance.overall)}
            />
            <div>
              <small>POSICIONES</small>
              <strong>
                {data.footballProfile?.preferredRoles.join(" · ") ||
                  "POR DEFINIR"}
              </strong>
              <span>
                {data.footballProfile?.willingToPlayGoalkeeper
                  ? "DISPONIBLE COMO PORTERO"
                  : "PERFIL F5"}
              </span>
            </div>
          </div>
          <div className={styles.heroActions}>
            <Link href="/profile/progression">Ver progresión</Link>
            <Link href="/profile/settings">Editar perfil</Link>
          </div>
        </header>
      </section>

      <div className={styles.profileLayout}>
        <div className={styles.profileContent}>
          <section
            className={`${styles.panelSection} ${styles.footballModule}`}
          >
            <div className={styles.visualModuleHeading}>
              <span>F5 / PERFIL DE JUEGO</span>
              <Text as="h2" variant="heading-lg">
                Tu zona en la cancha
              </Text>
            </div>
            <V4PlayIdentity
              attributes={data.performance.attributes}
              roles={data.footballProfile?.preferredRoles ?? []}
              strengths={data.footballProfile?.strengths ?? []}
              willingToPlayGoalkeeper={
                data.footballProfile?.willingToPlayGoalkeeper ?? false
              }
            />
          </section>

          <section className={`${styles.panelSection} ${styles.careerModule}`}>
            <div className={styles.careerHeading}>
              <div className={styles.careerIdentity}>
                {primaryGroup ? (
                  <V4GroupCrest
                    name={primaryGroup.name}
                    seed={primaryGroup.id}
                    size="large"
                  />
                ) : (
                  <span className={styles.careerF5Mark}>F5</span>
                )}
                <div>
                  <Text tone="accent" variant="label">
                    CARRERA TOTAL · FIFAR
                  </Text>
                  <Text as="h2" variant="heading-lg">
                    Tu carrera
                  </Text>
                  <small>
                    {primaryGroup?.name ?? "Identidad independiente"}
                  </small>
                </div>
              </div>
              <div className={styles.careerOvr}>
                <span>{Math.round(data.performance.overall)}</span>
                <small>OVR ACTUAL</small>
              </div>
            </div>
            <dl className={styles.careerMetrics}>
              <Metric
                mark="01"
                label="Partidos"
                value={data.performance.processedMatchCount}
              />
              <Metric
                mark="02"
                label="Promedio"
                value={formatRating(data.summary.averageRating)}
              />
              <Metric mark="03" label="Goles" value={data.summary.totalGoals} />
              <Metric
                mark="04"
                label="Asistencias"
                value={data.summary.totalAssists}
              />
            </dl>
          </section>

          <section
            className={`${styles.panelSection} ${styles.progressionModule}`}
          >
            <div className={styles.progressionArtwork} aria-hidden="true" />
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
              className="ui-button ui-button--primary"
              href="/profile/progression"
            >
              Ver historial de progreso
            </Link>
          </section>

          <CareerMarks rewards={data.rewards} />

          <section className={`${styles.panelSection} ${styles.groupsModule}`}>
            <div className={styles.moduleTitle}>
              <Text tone="accent" variant="label">
                VESTUARIO
              </Text>
              <Text as="h2" variant="heading-lg">
                Tus grupos
              </Text>
            </div>
            <ul className={styles.groupCarousel}>
              {data.groups.map((group) => (
                <li key={group.id}>
                  <V4GroupCrest
                    name={group.name}
                    seed={group.id}
                    size="large"
                  />
                  <Link href={`/groups/${group.id}`}>{group.name}</Link>
                  <small>
                    {group.visibility === "PRIVATE"
                      ? "GRUPO PRIVADO"
                      : "GRUPO PÚBLICO"}
                  </small>
                  {group.visibility === "PRIVATE" ? (
                    <Badge kind="state">PRIVADO</Badge>
                  ) : null}
                  <span aria-hidden="true" className={styles.rowArrow}>
                    ›
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
            <Link className={styles.textAction} href="/groups">
              Ver grupos
            </Link>
          </section>

          <section className={`${styles.panelSection} ${styles.networkModule}`}>
            <div className={styles.moduleTitle}>
              <Text tone="accent" variant="label">
                COMUNIDAD
              </Text>
              <Text as="h2" variant="heading-lg">
                Tu red
              </Text>
            </div>
            <div className={styles.appActions}>
              <Link href="/connections">
                <span aria-hidden="true">◎</span>
                <strong>Conexiones</strong>
                <small>Jugadores vinculados</small>
              </Link>
              <Link href="/invitations">
                <span aria-hidden="true">↗</span>
                <strong>Invitaciones</strong>
                <small>Solicitudes pendientes</small>
              </Link>
            </div>
          </section>

          <section
            className={`${styles.panelSection} ${styles.settingsModule}`}
          >
            <div>
              <Text as="h2" variant="heading-lg">
                Configuración
              </Text>
              <Text tone="muted">Perfil, privacidad y seguridad.</Text>
            </div>
            <Link
              className="ui-button ui-button--management"
              href="/profile/settings"
            >
              Configuración
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  mark,
}: Readonly<{ label: string; value: string | number; mark: string }>) {
  return (
    <div>
      <span aria-hidden="true">{mark}</span>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function formatRating(value: string | null) {
  return value === null ? "—" : Number(value).toFixed(1);
}
