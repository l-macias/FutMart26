"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { TacticalDivider } from "@football/football-ui";
import { Text } from "@football/ui";

import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";
import { ProfilePlayerCard } from "./profile-player-card";
import { CareerMarks } from "./career-marks";
import { ProfileSummary } from "./profile-summary";
import styles from "./profile.module.css";

export function ProfileScreen() {
  const player = useQuery({ queryKey: queryKeys.me, queryFn: api.me });
  const performance = useQuery({
    queryKey: queryKeys.performance,
    queryFn: api.performance,
  });
  const preferences = useQuery({
    queryKey: queryKeys.footballPreferences,
    queryFn: api.preferences,
  });
  const groups = useQuery({ queryKey: queryKeys.groups, queryFn: api.groups });
  const rewards = useQuery({
    queryKey: queryKeys.rewards,
    queryFn: api.rewards,
  });

  if (
    player.isPending ||
    performance.isPending ||
    preferences.isPending ||
    groups.isPending ||
    rewards.isPending
  ) {
    return (
      <div className={styles.page}>
        <p role="status">Preparando tu perfil F5…</p>
      </div>
    );
  }

  if (
    player.isError ||
    performance.isError ||
    preferences.isError ||
    groups.isError ||
    rewards.isError
  ) {
    return (
      <div className={styles.page}>
        <p role="alert">No pudimos cargar tu perfil F5.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <Text as="span" tone="accent" variant="label">
          Perfil
        </Text>
        <Text as="h1" variant="display-lg">
          Identidad F5
        </Text>
      </header>

      <div className={styles.profileLayout}>
        <aside className={styles.identity}>
          <div className={styles.identityHeading}>
            <div>
              <Text as="h2" variant="display-lg">
                {player.data.displayName}
              </Text>
              <Text as="span" tone="accent" variant="label">
                F5
              </Text>
            </div>
            <dl className={styles.identityMetrics}>
              <div>
                <dt>OVR actual</dt>
                <dd>{Math.round(performance.data.overall)}</dd>
              </div>
              <div>
                <dt>Partidos</dt>
                <dd>{performance.data.processedMatchCount}</dd>
              </div>
            </dl>
          </div>
          <ProfilePlayerCard
            image={player.data.image}
            name={player.data.displayName}
            performance={performance.data}
          />
        </aside>

        <main className={styles.profileContent}>
          <TacticalDivider />
          <ProfileSummary
            groups={groups.data}
            performance={performance.data}
            preferences={preferences.data}
          />
          <TacticalDivider />
          <CareerMarks rewards={rewards.data} />
          <TacticalDivider />
          <section className={styles.panelSection}>
            <Text as="h2" variant="heading-lg">
              Tu carrera
            </Text>
            <Text tone="muted">
              Recorré tu evolución partido a partido desde snapshots reales.
            </Text>
            <Link
              className="ui-button ui-button--secondary"
              href="/profile/progression"
            >
              Historial de progreso
            </Link>
          </section>
          <TacticalDivider />
          <section className={styles.panelSection}>
            <Text as="h2" variant="heading-lg">
              Tu identidad
            </Text>
            <Text tone="muted">
              Ajustá cómo te mostrás y cómo preferís jugar. Tu cuenta se
              administra por separado.
            </Text>
            <Link
              className="ui-button ui-button--secondary"
              href="/profile/edit"
            >
              Editar perfil
            </Link>
            <Link
              className="ui-button ui-button--secondary"
              href="/profile/preferences"
            >
              Preferencias de juego
            </Link>
            <Link
              className="ui-button ui-button--secondary"
              href="/profile/account"
            >
              Cuenta y seguridad
            </Link>
          </section>
          <TacticalDivider />
          <section className={styles.panelSection}>
            <Text as="h2" variant="heading-lg">
              Tu red
            </Text>
            <Link
              className="ui-button ui-button--secondary"
              href="/connections"
            >
              Ver conexiones
            </Link>
            <Link
              className="ui-button ui-button--secondary"
              href="/invitations"
            >
              Ver invitaciones
            </Link>
          </section>
        </main>
      </div>
    </div>
  );
}
