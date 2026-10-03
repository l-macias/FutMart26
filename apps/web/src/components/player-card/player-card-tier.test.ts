import assert from "node:assert/strict";
import test from "node:test";

import { getPlayerCardTier } from "./player-card-tier";

void test("Player Card tiers use the frozen OVR boundaries", () => {
  assert.equal(getPlayerCardTier(0), "bronze");
  assert.equal(getPlayerCardTier(59), "bronze");
  assert.equal(getPlayerCardTier(60), "silver");
  assert.equal(getPlayerCardTier(69), "silver");
  assert.equal(getPlayerCardTier(70), "gold");
  assert.equal(getPlayerCardTier(79), "gold");
  assert.equal(getPlayerCardTier(80), "elite");
  assert.equal(getPlayerCardTier(89), "elite");
  assert.equal(getPlayerCardTier(90), "legend");
  assert.equal(getPlayerCardTier(99), "legend");
});
