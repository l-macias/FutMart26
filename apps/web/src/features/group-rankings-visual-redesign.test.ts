import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

void test("Group uses one sports feature and shared compact rows", () => {
  assert.match(
    groupSource,
    /styles\.nextMatch} ui-surface ui-surface--feature/,
  );
  assert.match(groupSource, /styles\.member} ui-row/);
  assert.match(groupSource, /styles\.matchRow} ui-row/);
  assert.match(groupSource, /styles\.rankPreview} ui-row/);
  assert.match(groupSource, /styles\.activityRow} ui-row/);
  assert.match(groupSource, /ui-button ui-button--management/);
  assert.match(groupStyles, /\.rankPreview \{[\s\S]*?border: 0;/);
  assert.match(groupSource, /styles\.overviewGridArchived/);
  assert.match(groupStyles, /\.overviewGridArchived \.nextMatch/);
});

void test("Rankings keeps V1 scopes and renders a bounded comparable list", () => {
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
  assert.match(rankingsSource, /className={`\$\{styles\.list} ui-list`}/);
  assert.match(rankingsSource, /styles\.row} ui-row/);
  assert.match(rankingsSource, /aria-current=\{item\.isCurrentPlayer/);
  assert.match(rankingsStyles, /\.row \+ \.row \{[\s\S]*?border-block-start/);
  assert.match(rankingsStyles, /\.current a \{/);
});

void test("Group and Rankings mobile layouts retain compact three-column rows", () => {
  assert.match(groupStyles, /@media \(max-width: 25rem\)/);
  assert.match(
    groupStyles,
    /\.matchRow \{[\s\S]*?grid-template-columns: 3rem minmax\(0, 1fr\) auto;/,
  );
  assert.match(rankingsStyles, /@media \(max-width: 30rem\)/);
  assert.match(
    rankingsStyles,
    /\.row a \{[\s\S]*?grid-template-columns: 2\.5rem minmax\(0, 1fr\) auto;/,
  );
});
