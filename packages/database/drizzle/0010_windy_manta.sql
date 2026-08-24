CREATE TYPE "public"."match_team_assignment_source" AS ENUM('MANUAL', 'INTELLIGENT');--> statement-breakpoint
CREATE TYPE "public"."match_team_side" AS ENUM('TEAM_A', 'TEAM_B');--> statement-breakpoint
CREATE TYPE "public"."sporting_result_status" AS ENUM('DRAFT', 'CONFIRMED', 'NOT_PLAYED');--> statement-breakpoint
CREATE TABLE "match_sporting_results" (
	"id" uuid PRIMARY KEY NOT NULL,
	"match_id" uuid NOT NULL,
	"status" "sporting_result_status" DEFAULT 'DRAFT' NOT NULL,
	"team_a_goals" integer,
	"team_b_goals" integer,
	"updated_by_player_id" uuid NOT NULL,
	"confirmed_at" timestamp with time zone,
	"confirmed_by_player_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_sporting_results_state_ck" CHECK (("match_sporting_results"."status" = 'DRAFT' and "match_sporting_results"."team_a_goals" is not null and "match_sporting_results"."team_b_goals" is not null and "match_sporting_results"."confirmed_at" is null and "match_sporting_results"."confirmed_by_player_id" is null) or ("match_sporting_results"."status" = 'CONFIRMED' and "match_sporting_results"."team_a_goals" is not null and "match_sporting_results"."team_b_goals" is not null and "match_sporting_results"."confirmed_at" is not null and "match_sporting_results"."confirmed_by_player_id" is not null) or ("match_sporting_results"."status" = 'NOT_PLAYED' and "match_sporting_results"."team_a_goals" is null and "match_sporting_results"."team_b_goals" is null and "match_sporting_results"."confirmed_at" is not null and "match_sporting_results"."confirmed_by_player_id" is not null)),
	CONSTRAINT "match_sporting_results_scores_ck" CHECK (("match_sporting_results"."team_a_goals" is null or "match_sporting_results"."team_a_goals" >= 0) and ("match_sporting_results"."team_b_goals" is null or "match_sporting_results"."team_b_goals" >= 0))
);
--> statement-breakpoint
CREATE TABLE "match_team_assignments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"match_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"side" "match_team_side" NOT NULL,
	"source" "match_team_assignment_source" NOT NULL,
	"algorithm_version" text,
	"updated_by_player_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "match_participants_id_match_uq" ON "match_participants" USING btree ("id","match_id");--> statement-breakpoint
ALTER TABLE "match_sporting_results" ADD CONSTRAINT "match_sporting_results_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_sporting_results" ADD CONSTRAINT "match_sporting_results_updated_by_player_id_players_id_fk" FOREIGN KEY ("updated_by_player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_sporting_results" ADD CONSTRAINT "match_sporting_results_confirmed_by_player_id_players_id_fk" FOREIGN KEY ("confirmed_by_player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_team_assignments" ADD CONSTRAINT "match_team_assignments_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_team_assignments" ADD CONSTRAINT "match_team_assignments_updated_by_player_id_players_id_fk" FOREIGN KEY ("updated_by_player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_team_assignments" ADD CONSTRAINT "match_team_assignments_participant_match_fk" FOREIGN KEY ("participant_id","match_id") REFERENCES "public"."match_participants"("id","match_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "match_sporting_results_match_uq" ON "match_sporting_results" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "match_sporting_results_status_idx" ON "match_sporting_results" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "match_team_assignments_participant_uq" ON "match_team_assignments" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "match_team_assignments_match_side_idx" ON "match_team_assignments" USING btree ("match_id","side");
--> statement-breakpoint
CREATE FUNCTION enforce_match_team_assignment_write() RETURNS trigger AS $$
DECLARE
  target_match_id uuid;
  current_match_status match_status;
BEGIN
  target_match_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.match_id ELSE NEW.match_id END;
  SELECT status INTO current_match_status FROM matches WHERE id = target_match_id;
  IF current_match_status <> 'OPEN' THEN
    RAISE EXCEPTION 'team assignments are locked' USING ERRCODE = '23514', CONSTRAINT = 'match_team_assignments_open_match_ck';
  END IF;
  IF TG_OP <> 'DELETE' AND NOT EXISTS (
    SELECT 1 FROM match_participants
    WHERE id = NEW.participant_id AND match_id = NEW.match_id AND status = 'CONFIRMED'
  ) THEN
    RAISE EXCEPTION 'only confirmed participants can be assigned' USING ERRCODE = '23514', CONSTRAINT = 'match_team_assignments_confirmed_participant_ck';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER match_team_assignments_write_guard
BEFORE INSERT OR UPDATE OR DELETE ON match_team_assignments
FOR EACH ROW EXECUTE FUNCTION enforce_match_team_assignment_write();
