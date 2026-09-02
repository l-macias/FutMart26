import { Buffer } from "node:buffer";

import { z } from "zod";

import {
  countryCodeSchema,
  countryDisplayName,
  provinceCodeSchema,
  provinceDisplayName,
} from "@football/contracts";

import { ApplicationError } from "../errors.js";

const countryKeySchema = z
  .object({ version: z.literal(1), countryCode: countryCodeSchema })
  .strict();
const provinceKeySchema = z
  .object({ version: z.literal(1), provinceCode: provinceCodeSchema })
  .strict();

export function encodeCountryRankingKey(countryCode: string) {
  return encode({
    version: 1,
    countryCode: countryCodeSchema.parse(countryCode),
  });
}

export function decodeCountryRankingKey(value: string) {
  return decode(value, countryKeySchema, "invalid_country_key").countryCode;
}

export function encodeProvinceRankingKey(provinceCode: string) {
  return encode({
    version: 1,
    provinceCode: provinceCodeSchema.parse(provinceCode),
  });
}

export function decodeProvinceRankingKey(value: string) {
  return decode(value, provinceKeySchema, "invalid_province_key").provinceCode;
}

export function presentVenueGeography(
  countryCode: string | null,
  provinceCode: string | null,
) {
  return {
    countryCode,
    provinceCode,
    countryName: countryCode ? countryDisplayName(countryCode) : null,
    provinceName: provinceCode ? provinceDisplayName(provinceCode) : null,
    countryKey: countryCode ? encodeCountryRankingKey(countryCode) : null,
    provinceKey: provinceCode ? encodeProvinceRankingKey(provinceCode) : null,
  };
}

function encode(value: object) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decode<T extends z.ZodType>(
  value: string,
  schema: T,
  errorCode: "invalid_country_key" | "invalid_province_key",
): z.infer<T> {
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid base64url");
    return schema.parse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );
  } catch {
    throw new ApplicationError(errorCode, "Invalid geography key", 400);
  }
}
