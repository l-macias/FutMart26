import assert from "node:assert/strict";
import test from "node:test";

import { parseRankingScope, rankingHref } from "./rankings-navigation";

void test("Rankings defaults to GLOBAL and only accepts V1 scopes", () => {
  assert.equal(parseRankingScope(), "global");
  assert.equal(parseRankingScope("country"), "global");
  assert.equal(parseRankingScope("venue"), "venue");
});

void test("Rankings URLs preserve the selected bounded context", () => {
  assert.equal(
    rankingHref("group", { groupId: "group-id" }),
    "/rankings?scope=group&groupId=group-id",
  );
  assert.equal(
    rankingHref("city", { cityKey: "rosario|santa fe" }),
    "/rankings?scope=city&city=rosario%7Csanta+fe",
  );
  assert.equal(
    rankingHref("venue", { venueId: "venue-id" }),
    "/rankings?scope=venue&venueId=venue-id",
  );
});
