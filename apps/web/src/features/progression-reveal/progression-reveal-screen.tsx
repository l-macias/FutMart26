"use client";

import { useState } from "react";

import { TacticalDivider } from "@football/football-ui";
import { Button, Text } from "@football/ui";

import { ProgressionSummary } from "./progression-summary";
import {
  AttributeChanges,
  MatchRatingReveal,
  MilestoneReveal,
  OverallReveal,
  RevealContext,
  TierCardReveal,
  TierReveal,
} from "./reveal-stages";
import styles from "./progression-reveal.module.css";

type RevealScenario = "normal" | "tier";
type RevealStage =
  | "INTRO"
  | "MATCH_RATING"
  | "OVR"
  | "ATTRIBUTES"
  | "MILESTONE"
  | "TIER"
  | "CARD"
  | "SUMMARY";

const stageSequences: Record<RevealScenario, readonly RevealStage[]> = {
  normal: [
    "INTRO",
    "MATCH_RATING",
    "OVR",
    "ATTRIBUTES",
    "MILESTONE",
    "SUMMARY",
  ],
  tier: ["INTRO", "MATCH_RATING", "OVR", "TIER", "CARD", "SUMMARY"],
};

export function ProgressionRevealScreen() {
  const [scenario, setScenario] = useState<RevealScenario>("normal");
  const [stage, setStage] = useState<RevealStage>("INTRO");
  const sequence = stageSequences[scenario];
  const stageIndex = sequence.indexOf(stage);

  function chooseScenario(nextScenario: RevealScenario) {
    setScenario(nextScenario);
    setStage("INTRO");
  }

  function continueReveal() {
    setStage(sequence[stageIndex + 1] ?? "SUMMARY");
  }

  if (stage === "SUMMARY") {
    return (
      <ProgressionSummary
        onReplay={() => setStage("INTRO")}
        scenario={scenario}
      />
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.scenarioSwitch} aria-label="Escenario mock">
        <button
          aria-pressed={scenario === "normal"}
          onClick={() => chooseScenario("normal")}
          type="button"
        >
          Normal
        </button>
        <button
          aria-pressed={scenario === "tier"}
          onClick={() => chooseScenario("tier")}
          type="button"
        >
          Tier unlock
        </button>
      </div>

      {stage === "INTRO" ? (
        <section className={styles.intro}>
          <Text as="span" tone="accent" variant="label">
            Resultados listos
          </Text>
          <Text as="h1" variant="display-lg">
            Los del martes
          </Text>
          <Text tone="muted">
            La votación cerró. Tu evolución ya está lista.
          </Text>
          <Button onClick={continueReveal}>Ver mi progreso</Button>
        </section>
      ) : (
        <>
          <RevealContext />
          <TacticalDivider />
          <div className={styles.stage} key={stage}>
            {stage === "MATCH_RATING" ? <MatchRatingReveal /> : null}
            {stage === "OVR" ? <OverallReveal scenario={scenario} /> : null}
            {stage === "ATTRIBUTES" ? <AttributeChanges /> : null}
            {stage === "MILESTONE" ? <MilestoneReveal /> : null}
            {stage === "TIER" ? <TierReveal /> : null}
            {stage === "CARD" ? <TierCardReveal /> : null}
          </div>
          <div className={styles.revealActions}>
            <Button onClick={() => setStage("SUMMARY")} variant="quiet">
              Saltar
            </Button>
            <Button onClick={continueReveal}>Continuar</Button>
          </div>
        </>
      )}
    </div>
  );
}
