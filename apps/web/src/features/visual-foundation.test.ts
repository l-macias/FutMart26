import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function source(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const uiStyles = source("../../../../packages/ui/src/styles/index.css");
const button = source("../../../../packages/ui/src/button/button.tsx");
const surface = source("../../../../packages/ui/src/surface/surface.tsx");
const overall = source(
  "../../../../packages/football-ui/src/overall-display/overall-display.tsx",
);
const shell = source("../components/app-shell/app-shell.module.css");
const confirmDialog = source("../components/confirm-dialog/confirm-dialog.tsx");
const matchDetail = source("./matches/real-match-screen.tsx");
const accountSecurity = source("./account/account-security-screen.tsx");
const home = source("./global-home/global-home-screen.tsx");
const profile = source("./profile/profile-screen.tsx");
const publicProfile = source(
  "./public-player-profile/public-player-profile-screen.tsx",
);
const playerCardStyles = source(
  "../components/player-card/player-card.module.css",
);
const homeStyles = source("./global-home/global-home.module.css");
const matchStyles = source("./matches/matches.module.css");
const visualV3Components = source(
  "../components/visual-v3/visual-v3.module.css",
);
const visualV4Components = source(
  "../components/visual-v4/visual-v4.module.css",
);
const layout = source("../app/layout.tsx");
const playerCard = source("../components/player-card/player-card.tsx");
const shellComponent = source("../components/app-shell/app-shell.tsx");
const search = source("./player-discovery/player-discovery-screen.tsx");
const notifications = source("./notifications/notifications-screen.tsx");

void test("V2 tokens preserve Night Pitch and expose semantic color roles", () => {
  for (const value of ["#0b0e0c", "#121713", "#19201b", "#d7ff3f", "#2b7a4b"]) {
    assert.equal(uiStyles.includes(value), true);
  }

  for (const token of [
    "--color-accent",
    "--color-success",
    "--color-warning",
    "--color-danger",
    "--color-muted",
    "--color-surface-feature",
    "--color-overlay",
  ]) {
    assert.equal(uiStyles.includes(token), true);
  }
});

void test("action and surface variants encode the frozen hierarchy", () => {
  assert.equal(button.includes('"management"'), true);
  assert.equal(button.includes('"danger"'), true);
  assert.equal(surface.includes('"feature"'), true);
  assert.equal(surface.includes('"overlay"'), true);
  assert.equal(confirmDialog.includes('tone?: "default" | "danger"'), true);
  assert.equal(matchDetail.includes('tone="danger"'), true);
  assert.equal(accountSecurity.includes('tone="danger"'), true);
});

void test("compact rows, controls and mobile shell share density contracts", () => {
  assert.equal(uiStyles.includes("--row-min-height-compact"), true);
  assert.equal(uiStyles.includes("--control-height-default"), true);
  assert.equal(uiStyles.includes(".ui-row + .ui-row"), true);
  assert.equal(uiStyles.includes(".ui-field__error"), true);
  assert.equal(shell.includes("var(--page-gutter)"), true);
  assert.equal(shell.includes("env(safe-area-inset-bottom)"), true);
});

void test("OVR has bounded contextual sizes without changing card geometry", () => {
  assert.equal(
    overall.includes('size?: "compact" | "default" | "feature"'),
    true,
  );
  assert.equal(overall.includes("football-overall--${size}"), true);
});

void test("V3 compatibility tokens remain available beneath the global V4 shell", () => {
  for (const value of ["#0b1020", "#121a2c", "#19243b", "#d6b15f"]) {
    assert.equal(uiStyles.includes(value), true);
  }

  assert.match(uiStyles, /:root:has\(\.ui-visual-v3\)/);
  assert.match(home, /ui-visual-v4/);
  assert.match(profile, /ui-visual-v3/);
  assert.match(publicProfile, /ui-visual-v3/);
  assert.match(shellComponent, /ui-visual-v3 ui-visual-v4/);
  assert.doesNotMatch(shellComponent, /visualV3Pilot|profileV4Pilot/);
  assert.match(matchDetail, /styles\.page} ui-visual-v4/);
});

void test("V3 evolves the FIFAR Player Card without changing its geometry", () => {
  assert.match(playerCardStyles, /aspect-ratio: 2 \/ 3/);
  assert.match(playerCardStyles, /aspect-ratio: 4 \/ 5/);
  assert.match(playerCardStyles, /:global\(\.ui-visual-v3\) \.outerFrame/);
});

void test("V3 pilots share FIFAR signatures and local replaceable artwork", () => {
  assert.match(uiStyles, /--v3-cut/);
  assert.match(visualV3Components, /\.ovrPlate/);
  assert.match(visualV3Components, /\.crestPattern/);
  assert.match(homeStyles, /home-feature-night\.webp/);
  assert.match(homeStyles, /home-empty-pitch\.webp/);
  assert.match(homeStyles, /\.matchStrip/);
  assert.match(matchStyles, /\.heroMatchStrip/);
  assert.match(matchStyles, /match-open-night\.webp/);
});

void test("V4 is typographically distinct and stable across the player shell", () => {
  assert.match(uiStyles, /:root:has\(\.ui-visual-v4\)/);
  assert.match(uiStyles, /--v4-canvas/);
  assert.match(layout, /Teko/);
  assert.match(layout, /Titillium_Web/);
  assert.match(profile, /ui-visual-v4/);
  assert.match(publicProfile, /ui-visual-v4/);
  assert.match(visualV4Components, /\.rewardBadge/);
  assert.match(playerCard, /\/fifar-v4\/players-raster\/player-portrait-/);
  assert.match(playerCardStyles, /:global\(\.ui-visual-v4\) \.playerCard/);
  assert.match(home, /ui-visual-v4/);
  assert.match(matchDetail, /styles\.page} ui-visual-v4/);
  assert.match(search, /ui-visual-v4/);
  assert.match(notifications, /ui-visual-v4/);
  assert.match(shellComponent, /ui-visual-v3 ui-visual-v4/);
  assert.match(shellComponent, /pathname\.startsWith\(`\$\{item\.href\}\//);
  assert.doesNotMatch(shellComponent, /pathname\.startsWith\(item\.href\)/);
});

void test("AppShell owns the only main landmark in authenticated Profile routes", () => {
  assert.match(shellComponent, /<main className=\{styles\.content\}>/);
  assert.doesNotMatch(profile, /<main|<\/main>/);
  assert.doesNotMatch(publicProfile, /<main|<\/main>/);
});

void test("Home and Match OPEN visibly consume local V4 football scenes", () => {
  for (const asset of [
    "home-feature-night.webp",
    "home-empty-pitch.webp",
    "match-open-night.webp",
  ]) {
    assert.equal(
      existsSync(
        new URL(`../../public/fifar-v4/match-scenes/${asset}`, import.meta.url),
      ),
      true,
    );
  }

  assert.match(home, /home-feature-night\.webp/);
  assert.match(homeStyles, /home-empty-pitch\.webp/);
  assert.match(matchDetail, /match-open-night\.webp/);
  assert.match(home, /V4GroupCrest/);
  assert.match(matchDetail, /V4Portrait/);
});

void test("Player Card V4.2 is driven by five local raster shells", () => {
  for (const tier of ["bronze", "silver", "gold", "elite", "legend"]) {
    assert.equal(
      existsSync(
        new URL(`../../public/fifar-v4/cards/${tier}.webp`, import.meta.url),
      ),
      true,
    );
  }

  assert.match(playerCard, /\/fifar-v4\/cards\/\$\{tier\}\.webp/);
  assert.match(playerCardStyles, /\.shellLayer/);
  assert.match(playerCardStyles, /mask-image:/);
  assert.match(
    playerCardStyles,
    /:global\(\.ui-visual-v4\) \.skinLayer,[\s\S]*\.frameLayer[\s\S]*display: none/,
  );
});
