import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const ownProfile = read("./profile/profile-screen.tsx");
const ownProfileStyles = read("./profile/profile.module.css");
const publicProfile = read(
  "./public-player-profile/public-player-profile-screen.tsx",
);
const publicProfileStyles = read(
  "./public-player-profile/public-player-profile.module.css",
);
const search = read("./player-discovery/player-discovery-screen.tsx");
const searchStyles = read("./player-discovery/player-discovery.module.css");
const notifications = read("./notifications/notifications-screen.tsx");
const notificationStyles = read("./notifications/notifications.module.css");
const dropdown = read("./notifications/notification-dropdown.tsx");
const dropdownStyles = read("./notifications/notification-dropdown.module.css");

void test("Profile integrates the existing Player Card with compact career hierarchy", () => {
  assert.match(ownProfile, /<ProfilePlayerCard/);
  assert.match(ownProfile, /<OverallDisplay/);
  assert.ok(
    ownProfile.indexOf("Tu carrera") < ownProfile.indexOf("Tu progreso"),
  );
  assert.ok(
    ownProfile.indexOf("Tu progreso") < ownProfile.indexOf("<CareerMarks"),
  );
  assert.match(ownProfile, /ui-button ui-button--management/);
  assert.match(ownProfileStyles, /\.identity > figure/);
  assert.match(ownProfileStyles, /@media \(min-width: 80rem\)/);
});

void test("Public Profile keeps public identity distinct and awards authoritative", () => {
  assert.match(publicProfile, /<PlayerCard/);
  assert.match(publicProfile, /<OverallDisplay/);
  assert.match(publicProfile, /data\.rewards\.awardSummary\.map/);
  assert.doesNotMatch(publicProfile, /recentAwards\.map/);
  assert.match(publicProfile, /data\.visibility === "PRIVATE"/);
  assert.match(publicProfileStyles, /\.rewardList li[\s\S]*border-block-end/);
});

void test("Search remains bounded to Players and Groups and renders shared rows", () => {
  assert.match(search, /api\.globalSearch\(query, 5, signal\)/);
  assert.equal(
    search.includes("className={`${styles.results} ui-list`}"),
    true,
  );
  assert.match(search, /className="ui-row"/);
  assert.doesNotMatch(search, /Partidos encontrados|Sedes encontradas/);
  assert.match(
    searchStyles,
    /inline-size: min\(100%, var\(--content-reading\)\)/,
  );
  assert.match(
    searchStyles,
    /grid-template-columns: var\(--touch-target-min\)/,
  );
});

void test("Notifications use dense full-row navigation and a bounded overlay", () => {
  assert.equal(
    notifications.includes("className={`${styles.notificationRow} ui-row`}"),
    true,
  );
  assert.doesNotMatch(notifications, /<Surface/);
  assert.match(notifications, /variant="quiet"/);
  assert.match(
    notificationStyles,
    /color-mix\(in srgb, var\(--accent-primary\) 4%/,
  );
  assert.match(dropdown, /api\.notifications\(undefined, 5\)/);
  assert.match(dropdown, /unreadCount > 99 \? "99\+"/);
  assert.match(dropdownStyles, /max-block-size: min\(23rem/);
  assert.match(dropdownStyles, /overflow-y: auto/);
});
