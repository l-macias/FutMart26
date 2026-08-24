export type GroupCapability =
  | "GROUP_READ"
  | "GROUP_MANAGE_MEMBERS"
  | "GROUP_MANAGE_MODERATORS"
  | "GROUP_TRANSFER_OWNERSHIP"
  | "GROUP_ARCHIVE"
  | "MATCH_MANAGE"
  | "MATCH_MANAGE_GUESTS"
  | "MATCH_COMPLETE"
  | "MATCH_CONFIRM_ROSTER"
  | "MATCH_MANAGE_STATS"
  | "MATCH_MANAGE_OBSERVER"
  | "MATCH_MANAGE_VOTING"
  | "MATCH_MANAGE_TEAMS"
  | "GROUP_MANAGE_INVITATIONS"
  | "GROUP_MANAGE_GUEST_POLICY"
  | "GROUP_MANAGE_GUESTS"
  | "MATCH_GUEST_OVERRIDE";

const roleCapabilities = {
  OWNER: [
    "GROUP_READ",
    "GROUP_MANAGE_MEMBERS",
    "GROUP_MANAGE_MODERATORS",
    "GROUP_TRANSFER_OWNERSHIP",
    "GROUP_ARCHIVE",
    "MATCH_MANAGE",
    "MATCH_MANAGE_GUESTS",
    "MATCH_COMPLETE",
    "MATCH_CONFIRM_ROSTER",
    "MATCH_MANAGE_STATS",
    "MATCH_MANAGE_OBSERVER",
    "MATCH_MANAGE_VOTING",
    "MATCH_MANAGE_TEAMS",
    "GROUP_MANAGE_INVITATIONS",
    "GROUP_MANAGE_GUEST_POLICY",
    "GROUP_MANAGE_GUESTS",
    "MATCH_GUEST_OVERRIDE",
  ],
  MODERATOR: ["GROUP_READ"],
  MEMBER: ["GROUP_READ"],
} as const satisfies Record<string, readonly GroupCapability[]>;

export function hasGroupCapability(
  role: keyof typeof roleCapabilities,
  grants: readonly string[],
  capability: GroupCapability,
) {
  return groupCapabilities(role, grants).includes(capability);
}

export function groupCapabilities(
  role: keyof typeof roleCapabilities,
  grants: readonly string[],
): GroupCapability[] {
  const explicitGrants =
    role === "MODERATOR"
      ? grants.filter((grant): grant is GroupCapability =>
          Object.values(roleCapabilities).some((capabilities) =>
            (capabilities as readonly string[]).includes(grant),
          ),
        )
      : [];
  return [...new Set([...roleCapabilities[role], ...explicitGrants])];
}
