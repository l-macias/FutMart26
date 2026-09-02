CREATE TYPE "public"."admin_audit_action" AS ENUM('ACCOUNT_SUSPENDED', 'ACCOUNT_REACTIVATED', 'PLAYER_NAME_MODERATED', 'PLAYER_AVATAR_REMOVED', 'GROUP_FORCED_PRIVATE', 'GROUP_NAME_MODERATED', 'GROUP_ARCHIVED', 'REPORT_RESOLVED', 'REPORT_DISMISSED', 'BALLOT_VOIDED', 'INVITATION_REVOKED', 'MATCH_CANCELLED_BY_ADMIN');--> statement-breakpoint
CREATE TYPE "public"."admin_role" AS ENUM('SUPERADMIN');--> statement-breakpoint
CREATE TYPE "public"."admin_target_type" AS ENUM('ACCOUNT', 'PLAYER', 'GROUP', 'MATCH', 'REPORT', 'BALLOT', 'INVITATION');--> statement-breakpoint
CREATE TABLE "account_suspensions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"auth_user_id" text NOT NULL,
	"reason" text NOT NULL,
	"suspended_by_auth_user_id" text NOT NULL,
	"suspended_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reactivated_at" timestamp with time zone,
	"reactivated_by_auth_user_id" text,
	CONSTRAINT "account_suspensions_reactivation_ck" CHECK (("account_suspensions"."reactivated_at" is null and "account_suspensions"."reactivated_by_auth_user_id" is null) or ("account_suspensions"."reactivated_at" is not null and "account_suspensions"."reactivated_by_auth_user_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "admin_audit_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_auth_user_id" text NOT NULL,
	"action" "admin_audit_action" NOT NULL,
	"target_type" "admin_target_type" NOT NULL,
	"target_id" text NOT NULL,
	"reason" text NOT NULL,
	"metadata" jsonb,
	"request_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_audit_events_reason_length_ck" CHECK (char_length(btrim("admin_audit_events"."reason")) between 5 and 500)
);
--> statement-breakpoint
CREATE TABLE "admin_grants" (
	"auth_user_id" text PRIMARY KEY NOT NULL,
	"role" "admin_role" DEFAULT 'SUPERADMIN' NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "voting_ballots" DROP CONSTRAINT "voting_ballots_void_evidence_ck";--> statement-breakpoint
ALTER TABLE "abuse_reports" ADD COLUMN "handled_by_auth_user_id" text;--> statement-breakpoint
ALTER TABLE "abuse_reports" ADD COLUMN "resolution_note" text;--> statement-breakpoint
ALTER TABLE "voting_ballots" ADD COLUMN "voided_by_auth_user_id" text;--> statement-breakpoint
ALTER TABLE "account_suspensions" ADD CONSTRAINT "account_suspensions_auth_user_id_auth_user_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "public"."auth_user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_suspensions" ADD CONSTRAINT "account_suspensions_suspended_by_auth_user_id_auth_user_id_fk" FOREIGN KEY ("suspended_by_auth_user_id") REFERENCES "public"."auth_user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_suspensions" ADD CONSTRAINT "account_suspensions_reactivated_by_auth_user_id_auth_user_id_fk" FOREIGN KEY ("reactivated_by_auth_user_id") REFERENCES "public"."auth_user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_events" ADD CONSTRAINT "admin_audit_events_actor_auth_user_id_auth_user_id_fk" FOREIGN KEY ("actor_auth_user_id") REFERENCES "public"."auth_user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_grants" ADD CONSTRAINT "admin_grants_auth_user_id_auth_user_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "public"."auth_user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_suspensions_active_user_uq" ON "account_suspensions" USING btree ("auth_user_id") WHERE "account_suspensions"."reactivated_at" is null;--> statement-breakpoint
CREATE INDEX "account_suspensions_user_time_idx" ON "account_suspensions" USING btree ("auth_user_id","suspended_at");--> statement-breakpoint
CREATE INDEX "admin_audit_events_created_idx" ON "admin_audit_events" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "admin_audit_events_target_idx" ON "admin_audit_events" USING btree ("target_type","target_id","created_at");--> statement-breakpoint
ALTER TABLE "abuse_reports" ADD CONSTRAINT "abuse_reports_handled_by_auth_user_id_auth_user_id_fk" FOREIGN KEY ("handled_by_auth_user_id") REFERENCES "public"."auth_user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voting_ballots" ADD CONSTRAINT "voting_ballots_voided_by_auth_user_id_auth_user_id_fk" FOREIGN KEY ("voided_by_auth_user_id") REFERENCES "public"."auth_user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abuse_reports" ADD CONSTRAINT "abuse_reports_resolution_ck" CHECK (("abuse_reports"."status" = 'OPEN' and "abuse_reports"."resolved_at" is null and "abuse_reports"."handled_by_auth_user_id" is null) or ("abuse_reports"."status" <> 'OPEN' and "abuse_reports"."resolved_at" is not null));--> statement-breakpoint
ALTER TABLE "abuse_reports" ADD CONSTRAINT "abuse_reports_resolution_note_length_ck" CHECK ("abuse_reports"."resolution_note" is null or char_length("abuse_reports"."resolution_note") <= 1000);--> statement-breakpoint
ALTER TABLE "voting_ballots" ADD CONSTRAINT "voting_ballots_void_evidence_ck" CHECK (("voting_ballots"."status" = 'VALID' and "voting_ballots"."voided_at" is null and "voting_ballots"."voided_by_player_id" is null and "voting_ballots"."voided_by_auth_user_id" is null) or ("voting_ballots"."status" = 'VOIDED' and "voting_ballots"."voided_at" is not null and (("voting_ballots"."voided_by_player_id" is not null)::int + ("voting_ballots"."voided_by_auth_user_id" is not null)::int) = 1));
