CREATE TYPE "public"."progression_processing_outcome" AS ENUM('APPLIED', 'NEUTRAL', 'NO_EVIDENCE');--> statement-breakpoint
CREATE TYPE "public"."progression_rating_profile" AS ENUM('LIBRE', 'DEFENSIVO', 'MEDIO', 'OFENSIVO');--> statement-breakpoint
CREATE TYPE "public"."progression_streak_direction" AS ENUM('POSITIVE', 'NEGATIVE', 'NONE');--> statement-breakpoint
CREATE TABLE "player_performances" (
	"id" uuid PRIMARY KEY NOT NULL,
	"player_id" uuid NOT NULL,
	"discipline" "match_discipline" NOT NULL,
	"rating_profile" "progression_rating_profile" DEFAULT 'LIBRE' NOT NULL,
	"velocidad" numeric(24, 12) NOT NULL,
	"pase" numeric(24, 12) NOT NULL,
	"regate" numeric(24, 12) NOT NULL,
	"remate" numeric(24, 12) NOT NULL,
	"defensa" numeric(24, 12) NOT NULL,
	"fisico" numeric(24, 12) NOT NULL,
	"internal_ovr" numeric(24, 12) NOT NULL,
	"streak_direction" "progression_streak_direction" DEFAULT 'NONE' NOT NULL,
	"streak_count" integer DEFAULT 0 NOT NULL,
	"processed_match_count" integer DEFAULT 0 NOT NULL,
	"last_processed_match_id" uuid,
	"last_processed_scheduled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_performances_attributes_range_ck" CHECK ("player_performances"."velocidad" between 1 and 99 and "player_performances"."pase" between 1 and 99 and "player_performances"."regate" between 1 and 99 and "player_performances"."remate" between 1 and 99 and "player_performances"."defensa" between 1 and 99 and "player_performances"."fisico" between 1 and 99),
	CONSTRAINT "player_performances_streak_ck" CHECK (("player_performances"."streak_direction" = 'NONE' and "player_performances"."streak_count" = 0) or ("player_performances"."streak_direction" <> 'NONE' and "player_performances"."streak_count" > 0)),
	CONSTRAINT "player_performances_count_ck" CHECK ("player_performances"."processed_match_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "progression_config_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" text NOT NULL,
	"discipline" "match_discipline" NOT NULL,
	"document" jsonb NOT NULL,
	"activated_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "progression_snapshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"player_id" uuid NOT NULL,
	"match_id" uuid NOT NULL,
	"discipline" "match_discipline" NOT NULL,
	"before_attributes" jsonb NOT NULL,
	"after_attributes" jsonb NOT NULL,
	"attribute_deltas" jsonb NOT NULL,
	"before_ovr" numeric(24, 12) NOT NULL,
	"after_ovr" numeric(24, 12) NOT NULL,
	"ovr_delta" numeric(24, 12) NOT NULL,
	"evaluations_received" integer NOT NULL,
	"eligible_evaluators_for_target" integer NOT NULL,
	"aggregated_rating" numeric(24, 12),
	"participation_ratio" numeric(24, 12) NOT NULL,
	"confidence_multiplier" numeric(24, 12) NOT NULL,
	"raw_performance_signal" numeric(24, 12),
	"effective_performance_signal" numeric(24, 12),
	"streak_before" jsonb NOT NULL,
	"streak_after" jsonb NOT NULL,
	"streak_multiplier" numeric(24, 12) NOT NULL,
	"progression_budget" numeric(24, 12) NOT NULL,
	"base_distribution" jsonb NOT NULL,
	"tag_coverage" numeric(24, 12) NOT NULL,
	"tag_distribution" jsonb NOT NULL,
	"final_distribution" jsonb NOT NULL,
	"config_version_id" uuid NOT NULL,
	"processing_outcome" "progression_processing_outcome" NOT NULL,
	"processed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "progression_snapshots_counts_ck" CHECK ("progression_snapshots"."evaluations_received" >= 0 and "progression_snapshots"."eligible_evaluators_for_target" >= "progression_snapshots"."evaluations_received")
);
--> statement-breakpoint
ALTER TABLE "player_performances" ADD CONSTRAINT "player_performances_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_performances" ADD CONSTRAINT "player_performances_last_processed_match_id_matches_id_fk" FOREIGN KEY ("last_processed_match_id") REFERENCES "public"."matches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progression_snapshots" ADD CONSTRAINT "progression_snapshots_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progression_snapshots" ADD CONSTRAINT "progression_snapshots_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progression_snapshots" ADD CONSTRAINT "progression_snapshots_config_version_id_progression_config_versions_id_fk" FOREIGN KEY ("config_version_id") REFERENCES "public"."progression_config_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "player_performances_player_discipline_uq" ON "player_performances" USING btree ("player_id","discipline");--> statement-breakpoint
CREATE UNIQUE INDEX "progression_config_versions_discipline_version_uq" ON "progression_config_versions" USING btree ("discipline","version");--> statement-breakpoint
CREATE INDEX "progression_config_versions_active_idx" ON "progression_config_versions" USING btree ("discipline","activated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "progression_snapshots_player_match_discipline_uq" ON "progression_snapshots" USING btree ("player_id","match_id","discipline");--> statement-breakpoint
CREATE INDEX "progression_snapshots_player_processed_idx" ON "progression_snapshots" USING btree ("player_id","processed_at");--> statement-breakpoint
CREATE INDEX "progression_snapshots_match_idx" ON "progression_snapshots" USING btree ("match_id");
--> statement-breakpoint
INSERT INTO "progression_config_versions" ("id", "version", "discipline", "document", "activated_at") VALUES (
  '00000000-0000-4000-8000-000000000011',
  'f5-v1.1',
  'F5',
  '{"model":"F5_PROGRESSION_V1","calculationPrecision":40,"storageScale":12,"rounding":"ROUND_HALF_UP","attributes":["VELOCIDAD","PASE","REGATE","REMATE","DEFENSA","FISICO"],"attributeMin":"1","attributeMax":"99","ratingCurve":[["1","-1"],["2","-0.9"],["3","-0.75"],["4","-0.5"],["5","-0.2"],["6","0"],["7","0.2"],["8","0.5"],["9","0.8"],["10","1"]],"confidenceCurve":[["0","0"],["0.125","0.05"],["0.25","0.20"],["0.50","0.65"],["0.75","1.00"],["1","1.20"]],"ovrBands":[{"minOvr":"1","maxOvrExclusive":"70","positiveMultiplier":"1.40","negativeMultiplier":"0.60","maxPositiveOvrDelta":"1.20","maxNegativeOvrDelta":"0.60","maxPositiveAttributeDelta":"1.50","maxNegativeAttributeDelta":"0.80"},{"minOvr":"70","maxOvrExclusive":"80","positiveMultiplier":"1.10","negativeMultiplier":"0.80","maxPositiveOvrDelta":"0.90","maxNegativeOvrDelta":"0.70","maxPositiveAttributeDelta":"1.20","maxNegativeAttributeDelta":"0.90"},{"minOvr":"80","maxOvrExclusive":"90","positiveMultiplier":"0.80","negativeMultiplier":"0.80","maxPositiveOvrDelta":"0.60","maxNegativeOvrDelta":"0.70","maxPositiveAttributeDelta":"0.90","maxNegativeAttributeDelta":"0.90"},{"minOvr":"90","maxOvrExclusive":null,"positiveMultiplier":"0.45","negativeMultiplier":"0.80","maxPositiveOvrDelta":"0.35","maxNegativeOvrDelta":"0.70","maxPositiveAttributeDelta":"0.60","maxNegativeAttributeDelta":"0.90"}],"positiveStreakThreshold":"0.35","negativeStreakThreshold":"-0.35","streakMultipliers":{"third":"1.10","fourth":"1.15","fifthAndAbove":"1.20"},"baseOvrEquivalentScale":"0.80","maxTagBlend":"0.50","positiveDifficulty":[["1","1"],["69","1"],["79","0.85"],["89","0.65"],["94","0.40"],["99","0.20"]],"negativeDifficulty":[["1","0.35"],["60","0.55"],["70","0.70"],["80","0.85"],["90","1"],["99","1"]],"profileWeights":{"LIBRE":{"VELOCIDAD":"0.166667","PASE":"0.166667","REGATE":"0.166667","REMATE":"0.166667","DEFENSA":"0.166666","FISICO":"0.166666"},"DEFENSIVO":{"VELOCIDAD":"0.15","PASE":"0.18","REGATE":"0.10","REMATE":"0.07","DEFENSA":"0.30","FISICO":"0.20"},"MEDIO":{"VELOCIDAD":"0.15","PASE":"0.25","REGATE":"0.20","REMATE":"0.12","DEFENSA":"0.18","FISICO":"0.10"},"OFENSIVO":{"VELOCIDAD":"0.20","PASE":"0.12","REGATE":"0.25","REMATE":"0.25","DEFENSA":"0.06","FISICO":"0.12"}}}'::jsonb,
  '2026-01-01T00:00:00.000Z'
);
--> statement-breakpoint
CREATE FUNCTION prevent_progression_immutable_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is immutable', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER progression_config_versions_immutable
BEFORE UPDATE OR DELETE ON progression_config_versions
FOR EACH ROW EXECUTE FUNCTION prevent_progression_immutable_change();
--> statement-breakpoint
CREATE TRIGGER progression_snapshots_immutable
BEFORE UPDATE OR DELETE ON progression_snapshots
FOR EACH ROW EXECUTE FUNCTION prevent_progression_immutable_change();
