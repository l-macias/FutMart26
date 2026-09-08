export type MatchInformationArchitecture = {
  showAdmission: boolean;
  showOperationalRoster: boolean;
  showRecruitment: boolean;
  showStartedTeams: boolean;
  showFinishedSummary: boolean;
  showOrganizerTools: boolean;
};

export function matchInformationArchitecture(
  phase: EffectiveMatchPhase,
  canUseOrganizerTools: boolean,
): MatchInformationArchitecture {
  return {
    showAdmission: phase === "DRAFT" || phase === "OPEN",
    showOperationalRoster: phase === "OPEN",
    showRecruitment: phase === "DRAFT" || phase === "OPEN",
    showStartedTeams: phase === "IN_PROGRESS" || phase === "AWAITING_RESULT",
    showFinishedSummary: phase === "VOTING_OPEN" || phase === "FINISHED",
    showOrganizerTools:
      canUseOrganizerTools &&
      ["DRAFT", "OPEN", "IN_PROGRESS", "AWAITING_RESULT"].includes(phase),
  };
}
import type { EffectiveMatchPhase } from "@football/contracts";
