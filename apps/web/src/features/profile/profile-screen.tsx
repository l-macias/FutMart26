"use client";

import { useState } from "react";

import { TacticalDivider } from "@football/football-ui";
import { Text } from "@football/ui";

import { CareerMarks } from "./career-marks";
import { PlayerCardMock } from "./player-card-mock";
import { PlayerStats } from "./player-stats";
import { profileMock } from "./profile-mock-content";
import { ProfileSummary } from "./profile-summary";
import { ProgressionTimeline } from "./progression-timeline";
import styles from "./profile.module.css";

type ProfileSection = "summary" | "stats" | "progression" | "marks";

const tabs = [
  { id: "summary", label: "Resumen" },
  { id: "stats", label: "Stats" },
  { id: "progression", label: "Progresión" },
  { id: "marks", label: "Logros" },
] as const satisfies readonly { id: ProfileSection; label: string }[];

export function ProfileScreen() {
  const [activeSection, setActiveSection] = useState<ProfileSection>("summary");

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
                {profileMock.name}
              </Text>
              <Text as="span" tone="accent" variant="label">
                {profileMock.discipline}
              </Text>
            </div>
            <dl className={styles.identityMetrics}>
              <div>
                <dt>OVR actual</dt>
                <dd>{profileMock.overall}</dd>
              </div>
              <div>
                <dt>Personal best</dt>
                <dd>{profileMock.personalBest}</dd>
              </div>
            </dl>
          </div>
          <PlayerCardMock />
        </aside>

        <main className={styles.profileContent}>
          <TacticalDivider />
          <div
            aria-label="Secciones del perfil"
            className={styles.tabs}
            role="tablist"
          >
            {tabs.map((tab) => (
              <button
                aria-controls={`profile-panel-${tab.id}`}
                aria-selected={activeSection === tab.id}
                id={`profile-tab-${tab.id}`}
                key={tab.id}
                onClick={() => setActiveSection(tab.id)}
                role="tab"
                tabIndex={activeSection === tab.id ? 0 : -1}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div
            aria-labelledby={`profile-tab-${activeSection}`}
            className={styles.tabPanel}
            id={`profile-panel-${activeSection}`}
            role="tabpanel"
          >
            {activeSection === "summary" ? <ProfileSummary /> : null}
            {activeSection === "stats" ? <PlayerStats /> : null}
            {activeSection === "progression" ? <ProgressionTimeline /> : null}
            {activeSection === "marks" ? <CareerMarks /> : null}
          </div>
        </main>
      </div>
    </div>
  );
}
