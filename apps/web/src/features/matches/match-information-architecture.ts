export type MatchInformationArchitecture = {
  showAdmission: boolean;
  showOperationalRoster: boolean;
  showRecruitment: boolean;
  showStartedTeams: boolean;
  showFinishedSummary: boolean;
  showOrganizerTools: boolean;
};

export function matchInformationArchitecture(
  status: "DRAFT" | "OPEN" | "STARTED" | "FINISHED" | "CANCELLED",
  canUseOrganizerTools: boolean,
): MatchInformationArchitecture {
  return {
    showAdmission: status === "DRAFT" || status === "OPEN",
    showOperationalRoster: status === "OPEN",
    showRecruitment: status === "DRAFT" || status === "OPEN",
    showStartedTeams: status === "STARTED",
    showFinishedSummary: status === "FINISHED",
    showOrganizerTools:
      canUseOrganizerTools &&
      (status === "DRAFT" || status === "OPEN" || status === "STARTED"),
  };
}
