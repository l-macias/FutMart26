ALTER TABLE "venues" ADD COLUMN "country_code" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "province_code" text;--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_country_code_format_ck" CHECK ("venues"."country_code" is null or "venues"."country_code" ~ '^[A-Z]{2}$');--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_province_code_format_ck" CHECK ("venues"."province_code" is null or "venues"."province_code" ~ '^[A-Z]{2}-[A-Z0-9]{1,3}$');--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_province_country_ck" CHECK ("venues"."province_code" is null or ("venues"."country_code" is not null and split_part("venues"."province_code", '-', 1) = "venues"."country_code"));