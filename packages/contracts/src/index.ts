import { z } from "zod";

export const healthResponseSchema = z.object({ status: z.literal("ok") });
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const idSchema = z.uuid();
export const playerSchema = z.object({ id: idSchema, displayName: z.string() });
export const groupRoleSchema = z.enum(["OWNER", "MODERATOR", "MEMBER"]);
export const groupCapabilitySchema = z.enum([
  "GROUP_READ",
  "GROUP_MANAGE_MEMBERS",
  "GROUP_MANAGE_MODERATORS",
  "GROUP_TRANSFER_OWNERSHIP",
  "GROUP_ARCHIVE",
]);
export const groupStatusSchema = z.enum(["ACTIVE", "ARCHIVED"]);
export const membershipStatusSchema = z.enum(["ACTIVE", "LEFT", "REMOVED"]);
export const groupSchema = z.object({
  id: idSchema,
  name: z.string(),
  status: groupStatusSchema,
  role: groupRoleSchema,
  capabilities: z.array(groupCapabilitySchema),
});
export const membershipSchema = z.object({
  id: idSchema,
  player: playerSchema,
  role: groupRoleSchema,
  capabilities: z.array(groupCapabilitySchema),
  status: membershipStatusSchema,
  joinedAt: z.iso.datetime(),
});
export const createGroupRequestSchema = z
  .object({ name: z.string().trim().min(1).max(100) })
  .strict();
export const ownershipTransferRequestSchema = z
  .object({ targetPlayerId: idSchema })
  .strict();
export const groupIdParamsSchema = z.object({ groupId: idSchema });
export const groupMemberParamsSchema = z.object({
  groupId: idSchema,
  playerId: idSchema,
});
export type PlayerResponse = z.infer<typeof playerSchema>;
export type GroupResponse = z.infer<typeof groupSchema>;
export type MembershipResponse = z.infer<typeof membershipSchema>;
