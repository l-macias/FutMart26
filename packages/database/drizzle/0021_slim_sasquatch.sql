CREATE TYPE "public"."abuse_report_reason" AS ENUM('HARASSMENT', 'INAPPROPRIATE_CONTENT', 'IMPERSONATION', 'SPAM', 'SAFETY', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."abuse_report_status" AS ENUM('OPEN', 'RESOLVED', 'DISMISSED');--> statement-breakpoint
CREATE TYPE "public"."abuse_report_target_type" AS ENUM('PLAYER', 'GROUP', 'MATCH');--> statement-breakpoint
CREATE TYPE "public"."player_account_status" AS ENUM('ACTIVE', 'ANONYMIZED');--> statement-breakpoint
CREATE TYPE "public"."policy_type" AS ENUM('TERMS', 'PRIVACY');--> statement-breakpoint
CREATE TYPE "public"."profile_visibility" AS ENUM('PUBLIC', 'PRIVATE');--> statement-breakpoint
CREATE TABLE "abuse_reports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reporter_player_id" uuid NOT NULL,
	"target_type" "abuse_report_target_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"reason" "abuse_report_reason" NOT NULL,
	"comment" text,
	"status" "abuse_report_status" DEFAULT 'OPEN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "abuse_reports_comment_length_ck" CHECK ("abuse_reports"."comment" is null or char_length("abuse_reports"."comment") <= 1000)
);
--> statement-breakpoint
CREATE TABLE "policy_acceptances" (
	"id" uuid PRIMARY KEY NOT NULL,
	"auth_user_id" text NOT NULL,
	"type" "policy_type" NOT NULL,
	"version" text NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "players" DROP CONSTRAINT "players_auth_user_id_auth_user_id_fk";
--> statement-breakpoint
ALTER TABLE "players" ALTER COLUMN "auth_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "visibility" "profile_visibility" DEFAULT 'PUBLIC' NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "date_of_birth" date;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "profile_visibility" "profile_visibility" DEFAULT 'PUBLIC' NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "account_status" "player_account_status" DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "anonymized_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "abuse_reports" ADD CONSTRAINT "abuse_reports_reporter_player_id_players_id_fk" FOREIGN KEY ("reporter_player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_acceptances" ADD CONSTRAINT "policy_acceptances_auth_user_id_auth_user_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "abuse_reports_reporter_created_idx" ON "abuse_reports" USING btree ("reporter_player_id","created_at");--> statement-breakpoint
CREATE INDEX "abuse_reports_status_created_idx" ON "abuse_reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "policy_acceptances_user_type_version_uq" ON "policy_acceptances" USING btree ("auth_user_id","type","version");--> statement-breakpoint
CREATE INDEX "policy_acceptances_user_idx" ON "policy_acceptances" USING btree ("auth_user_id");--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_auth_user_id_auth_user_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;