import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const groupSource = readFileSync(
  new URL("./groups/group-detail-screen.tsx", import.meta.url),
  "utf8",
);
const groupStyles = readFileSync(
  new URL("./groups/groups.module.css", import.meta.url),
  "utf8",
);
const rankingsSource = readFileSync(
  new URL("./rankings/rankings-screen.tsx", import.meta.url),
  "utf8",
);
const rankingsStyles = readFileSync(
  new URL("./rankings/rankings.module.css", import.meta.url),
  "utf8",
);

void test("Group V4 recomposes identity, match, roster, stats and activity with visual assets", () => {
  assert.match(groupSource, /styles\.page} ui-visual-v4/);
  assert.match(groupSource, /group-club-night\.webp/);
  assert.match(groupSource, /match-open-night\.webp/);
  assert.match(groupSource, /<V4GroupCrest/);
  assert.match(groupSource, /<V4Portrait/);
  assert.match(groupSource, /<V4TierPlate/);
  assert.match(groupSource, /<ActivityVisual/);
  assert.match(groupSource, /ui-button ui-button--management/);
  assert.match(
    groupStyles,
    /\.page:global\(\.ui-visual-v4\) \.memberList \{[\s\S]*?display: grid;/,
  );
  assert.match(groupStyles, /\.page:global\(\.ui-visual-v4\) \.statsStrip \{/);
  assert.match(groupStyles, /\.page:global\(\.ui-visual-v4\) \.activityRow \{/);
});

void test("Group keeps its bounded and lazy information architecture", () => {
  assert.match(groupSource, /api\.groupRanking\(groupId, undefined, 3\)/);
  assert.match(groupSource, /api\.groupActivity\(groupId, undefined, 4\)/);
  assert.match(groupSource, /enabled: showFullRoster && overview\.isSuccess/);
  assert.match(groupSource, /setShowFullRoster/);
  assert.match(groupSource, /styles\.overviewGridArchived/);
  assert.match(groupSource, /ranking\.data\.items\.map/);
});

void test("Rankings V4 keeps V1 scopes and adds a visual top three and actor context", () => {
  for (const scope of [
    'global: "GLOBAL"',
    'group: "GRUPO"',
    'city: "CIUDAD"',
    'venue: "SEDE"',
  ]) {
    assert.equal(rankingsSource.includes(scope), true);
  }
  assert.equal(rankingsSource.includes('province: "PROVINCIA"'), false);
  assert.equal(rankingsSource.includes('country: "PAÍS"'), false);
  assert.match(rankingsSource, /rankings-arena-night\.webp/);
  assert.match(rankingsSource, /topPlayers = items\.slice\(0, 3\)/);
  assert.match(rankingsSource, /rankedPlayers = items\.slice\(3\)/);
  assert.match(rankingsSource, /<RankingTopPlayer/);
  assert.match(rankingsSource, /<V4Portrait/);
  assert.match(rankingsSource, /<V4TierPlate/);
  assert.match(rankingsSource, /aria-current=\{item\.isCurrentPlayer/);
  assert.match(rankingsStyles, /\.topPlayer\[data-rank="1"\] \{/);
  assert.match(
    rankingsStyles,
    /\.page:global\(\.ui-visual-v4\) \.positionCard \{/,
  );
  assert.match(rankingsStyles, /\.page:global\(\.ui-visual-v4\) \.row a \{/);
});

void test("Group and Rankings keep mobile sports layouts free of horizontal page overflow", () => {
  assert.match(groupStyles, /overflow-x: clip;/);
  assert.match(groupStyles, /@media \(max-width: 48rem\)/);
  assert.match(
    groupStyles,
    /\.page:global\(\.ui-visual-v4\) \.memberList \{[\s\S]*?overflow-x: auto;/,
  );
  assert.match(rankingsStyles, /overflow-x: clip;/);
  assert.match(rankingsStyles, /@media \(max-width: 48rem\)/);
  assert.match(
    rankingsStyles,
    /\.topGrid \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/,
  );
});

void test("Group and Rankings V4 raster scenes are local and optimized", () => {
  for (const asset of [
    "../../public/fifar-v4/group-ranking-scenes/group-club-night.webp",
    "../../public/fifar-v4/group-ranking-scenes/rankings-arena-night.webp",
  ]) {
    const url = new URL(asset, import.meta.url);
    assert.equal(existsSync(url), true, `${asset} should exist`);
  }
});
