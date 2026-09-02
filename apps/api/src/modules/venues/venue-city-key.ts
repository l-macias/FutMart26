import { Buffer } from "node:buffer";

import { z } from "zod";

import { ApplicationError } from "../errors.js";

const cityKeySchema = z
  .object({ version: z.literal(1), normalizedCity: z.string().min(1).max(100) })
  .strict();

export function normalizePlaceName(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es");
}

export function encodeCityRankingKey(normalizedCity: string) {
  return Buffer.from(
    JSON.stringify({ version: 1, normalizedCity }),
    "utf8",
  ).toString("base64url");
}

export function decodeCityRankingKey(value: string) {
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid base64url");
    return cityKeySchema.parse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    ).normalizedCity;
  } catch {
    throw new ApplicationError("invalid_city_key", "Invalid city key", 400);
  }
}
