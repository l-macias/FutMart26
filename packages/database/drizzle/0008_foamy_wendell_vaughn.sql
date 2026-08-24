CREATE TYPE "public"."ballot_mode" AS ENUM('QUICK', 'FULL');--> statement-breakpoint
CREATE TYPE "public"."ballot_status" AS ENUM('VALID', 'VOIDED');--> statement-breakpoint
CREATE TYPE "public"."evaluation_evidence_attribute" AS ENUM('PASE', 'REGATE', 'REMATE', 'DEFENSA', 'VELOCIDAD', 'FISICO');--> statement-breakpoint
CREATE TYPE "public"."evaluation_evidence_type" AS ENUM('STRENGTH', 'IMPROVEMENT');--> statement-breakpoint
CREATE TYPE "public"."quick_signal" AS ENUM('POSITIVE', 'IMPROVEMENT');--> statement-breakpoint
CREATE TYPE "public"."voting_close_reason" AS ENUM('ALL_ELIGIBLE_VOTED', 'DEADLINE');--> statement-breakpoint
CREATE TYPE "public"."voting_session_status" AS ENUM('OPEN', 'CLOSED');--> statement-breakpoint
CREATE TABLE "evaluation_evidence" (
	"id" uuid PRIMARY KEY NOT NULL,
	"evaluation_id" uuid NOT NULL,
	"type" "evaluation_evidence_type" NOT NULL,
	"attribute" "evaluation_evidence_attribute" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_evaluations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"ballot_id" uuid NOT NULL,
	"target_participant_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"quick_signal" "quick_signal",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_evaluations_rating_ck" CHECK ("player_evaluations"."rating" between 1 and 10),
	CONSTRAINT "player_evaluations_quick_rating_ck" CHECK ("player_evaluations"."quick_signal" is null or ("player_evaluations"."quick_signal" = 'POSITIVE' and "player_evaluations"."rating" between 7 and 10) or ("player_evaluations"."quick_signal" = 'IMPROVEMENT' and "player_evaluations"."rating" between 1 and 5))
);
--> statement-breakpoint
CREATE TABLE "voting_ballots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"voter_player_id" uuid NOT NULL,
	"mode" "ballot_mode" NOT NULL,
	"status" "ballot_status" DEFAULT 'VALID' NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by_player_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "voting_ballots_void_evidence_ck" CHECK (("voting_ballots"."status" = 'VALID' and "voting_ballots"."voided_at" is null and "voting_ballots"."voided_by_player_id" is null) or ("voting_ballots"."status" = 'VOIDED' and "voting_ballots"."voided_at" is not null and "voting_ballots"."voided_by_player_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "voting_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"match_id" uuid NOT NULL,
	"status" "voting_session_status" DEFAULT 'OPEN' NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	"close_reason" "voting_close_reason",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "voting_sessions_close_evidence_ck" CHECK (("voting_sessions"."status" = 'OPEN' and "voting_sessions"."closed_at" is null and "voting_sessions"."close_reason" is null) or ("voting_sessions"."status" = 'CLOSED' and "voting_sessions"."closed_at" is not null and "voting_sessions"."close_reason" is not null)),
	CONSTRAINT "voting_sessions_window_ck" CHECK ("voting_sessions"."closes_at" > "voting_sessions"."opened_at")
);
--> statement-breakpoint
ALTER TABLE "evaluation_evidence" ADD CONSTRAINT "evaluation_evidence_evaluation_id_player_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."player_evaluations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_evaluations" ADD CONSTRAINT "player_evaluations_ballot_id_voting_ballots_id_fk" FOREIGN KEY ("ballot_id") REFERENCES "public"."voting_ballots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_evaluations" ADD CONSTRAINT "player_evaluations_target_participant_id_match_participants_id_fk" FOREIGN KEY ("target_participant_id") REFERENCES "public"."match_participants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voting_ballots" ADD CONSTRAINT "voting_ballots_session_id_voting_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."voting_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voting_ballots" ADD CONSTRAINT "voting_ballots_voter_player_id_players_id_fk" FOREIGN KEY ("voter_player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voting_ballots" ADD CONSTRAINT "voting_ballots_voided_by_player_id_players_id_fk" FOREIGN KEY ("voided_by_player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voting_sessions" ADD CONSTRAINT "voting_sessions_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "evaluation_evidence_evaluation_type_attribute_uq" ON "evaluation_evidence" USING btree ("evaluation_id","type","attribute");--> statement-breakpoint
CREATE INDEX "evaluation_evidence_evaluation_idx" ON "evaluation_evidence" USING btree ("evaluation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "player_evaluations_ballot_target_uq" ON "player_evaluations" USING btree ("ballot_id","target_participant_id");--> statement-breakpoint
CREATE INDEX "player_evaluations_target_idx" ON "player_evaluations" USING btree ("target_participant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "voting_ballots_session_voter_uq" ON "voting_ballots" USING btree ("session_id","voter_player_id");--> statement-breakpoint
CREATE INDEX "voting_ballots_session_status_idx" ON "voting_ballots" USING btree ("session_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "voting_sessions_match_uq" ON "voting_sessions" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "voting_sessions_status_closes_idx" ON "voting_sessions" USING btree ("status","closes_at");