import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const home = readFileSync(
  new URL("../global-home/global-home-screen.tsx", import.meta.url),
  "utf8",
);
const play = readFileSync(
  new URL("./play-screen.tsx", import.meta.url),
  "utf8",
);
const compactMatch = readFileSync(
  new URL("./compact-match.tsx", import.meta.url),
  "utf8",
);
const homeStyles = readFileSync(
  new URL("../global-home/global-home.module.css", import.meta.url),
  "utf8",
);
const playStyles = readFileSync(
  new URL("./play.module.css", import.meta.url),
  "utf8",
);

void test("Home prioritizes personal attention without restoring global discovery", () => {
  assert.ok(
    home.indexOf("<HomeMatchFeature") < home.indexOf("Necesita tu atención"),
  );
  assert.ok(
    home.indexOf("Necesita tu atención") <
      home.indexOf("Partidos buscando jugadores"),
  );
  assert.equal(home.includes("JUGADORES DESTACADOS"), false);
  assert.equal(home.includes("RANKING GLOBAL · F5"), false);
  assert.equal(home.includes("FeaturedGroups"), false);
  assert.equal(home.includes("attributes"), false);
  assert.equal(home.includes("/play/matches/${item.matchId}"), true);
});

void test("Play separates opportunities, upcoming and history without duplicates", () => {
  assert.equal(play.includes('useState<"upcoming" | "history">'), true);
  assert.equal(play.includes("matches.data.current ??"), true);
  assert.equal(play.includes("matches.data.upcoming.slice(1)"), true);
  assert.equal(play.includes("matches.data.history"), true);
  assert.equal(play.includes("Actividad reciente"), false);
  assert.equal(play.includes("BORRADORES"), false);
  assert.equal(play.includes("/play/matches/${match.id}"), true);
});

void test("Home and Play V4 preserve distinct sports collection contracts", () => {
  assert.equal(compactMatch.includes("home-feature-night.webp"), true);
  assert.equal(compactMatch.includes("V4GroupCrest"), true);
  assert.equal(compactMatch.includes("ui-button--primary"), true);
  assert.equal(home.includes("<HomeMatchFeature"), true);
  assert.equal(home.includes("attentionDeck"), true);
  assert.equal(home.includes("opportunityRail"), true);
  assert.equal(homeStyles.includes("home-feature-night.webp"), true);
  assert.equal(homeStyles.includes("home-empty-pitch.webp"), true);
  assert.equal(home.includes("V4GroupCrest"), true);
  assert.equal(home.includes("V4Portrait"), true);
  assert.equal(play.includes("OpportunityCard"), true);
  assert.equal(play.includes("opportunityGrid"), true);
  assert.equal(play.includes("MatchDeck"), true);
  assert.equal(play.includes("V4GroupCrest"), true);
  assert.equal(playStyles.includes("match-open-night.webp"), true);
  assert.equal(playStyles.includes("grid-auto-flow: column"), true);
  assert.equal(playStyles.includes('data-view="history"'), true);
  assert.equal(homeStyles.includes("var(--density-feature-padding)"), false);
  assert.equal(playStyles.includes("200px"), false);
});

void test("Play V4 varies opportunities without inventing missing domain data", () => {
  assert.equal(play.includes("matchesMyProfile"), true);
  assert.equal(play.includes("item.needs.slice(0, 2)"), true);
  assert.equal(play.includes("item.openSpots"), true);
  assert.equal(play.includes("item.capacity"), false);
  assert.equal(play.includes("item.participants"), false);
  assert.equal(play.includes("item.overall"), false);
  assert.equal(play.includes("ui-visual-v4"), true);
});

void test("Play tabs expose accessible selected state without changing views", () => {
  assert.equal(play.includes('role="tablist"'), true);
  assert.equal(play.match(/\srole="tab"\n/g)?.length, 2);
  assert.equal(play.includes('role="tabpanel"'), true);
  assert.equal(play.includes("aria-selected={matchView ==="), true);
  assert.equal(play.includes("onKeyDown={navigateMatchTabs}"), true);
  assert.equal(play.includes("tabIndex={matchView ==="), true);
});
