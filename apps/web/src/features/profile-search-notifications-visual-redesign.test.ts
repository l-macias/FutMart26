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

void test("Profile V4 integrates a visual identity object with compact career hierarchy", () => {
  assert.match(ownProfile, /<ProfilePlayerCard/);
  assert.match(ownProfile, /<OvrPlate/);
  assert.ok(
    ownProfile.indexOf("Tu carrera") < ownProfile.indexOf("Tu progreso"),
  );
  assert.ok(
    ownProfile.indexOf("Tu progreso") < ownProfile.indexOf("<CareerMarks"),
  );
  assert.match(ownProfile, /ui-button ui-button--management/);
  assert.match(ownProfileStyles, /\.identityStage/);
  assert.match(ownProfile, /ui-visual-v4/);
  assert.match(ownProfile, /V4GroupCrest/);
  assert.match(ownProfile, /V4PlayIdentity/);
  assert.doesNotMatch(ownProfile, /TacticalDivider/);
  assert.match(ownProfileStyles, /players-tunnel\.webp/);
  assert.match(ownProfileStyles, /night-pitch\.webp/);
  assert.match(ownProfileStyles, /@media \(min-width: 80rem\)/);
  assert.doesNotMatch(ownProfile, /<main|<\/main>/);
});

void test("Public Profile keeps public identity distinct and awards authoritative", () => {
  assert.match(publicProfile, /<PlayerCard/);
  assert.match(publicProfile, /<OvrPlate/);
  assert.match(publicProfile, /data\.rewards\.awardSummary\.map/);
  assert.doesNotMatch(publicProfile, /recentAwards\.map/);
  assert.match(publicProfile, /data\.visibility === "PRIVATE"/);
  assert.match(publicProfile, /data\.visibility === "ANONYMIZED"/);
  assert.match(publicProfile, /PERFIL HISTÓRICO/);
  assert.match(publicProfile, /Esta cuenta fue eliminada/);
  assert.match(publicProfile, /<PlayerAvatar/);
  assert.ok(
    publicProfile.indexOf('data.visibility === "ANONYMIZED"') <
      publicProfile.indexOf("<ConnectionControls"),
  );
  assert.match(publicProfile, /ui-visual-v4/);
  assert.match(publicProfile, /V4GroupCrest/);
  assert.match(publicProfile, /V4RewardBadge/);
  assert.match(publicProfile, /V4PlayIdentity/);
  assert.match(publicProfileStyles, /\.rewardList li[\s\S]*scroll-snap-align/);
  assert.match(publicProfileStyles, /\.publicIdentity/);
  assert.match(publicProfileStyles, /night-pitch\.webp/);
  assert.match(publicProfileStyles, /players-tunnel\.webp/);
  assert.doesNotMatch(publicProfile, /<main|<\/main>/);
});

void test("Search V4 keeps bounded discovery and gives Players and Groups distinct identity", () => {
  assert.match(search, /api\.globalSearch\(query, 5, signal\)/);
  assert.match(search, /V4Portrait/);
  assert.match(search, /V4TierPlate/);
  assert.match(search, /V4GroupCrest/);
  assert.match(search, /playerGrid/);
  assert.match(search, /groupGrid/);
  assert.match(search, /ui-visual-v4/);
  assert.doesNotMatch(search, /Partidos encontrados|Sedes encontradas/);
  assert.match(searchStyles, /players-tunnel\.webp/);
  assert.match(searchStyles, /group-club-night\.webp/);
  assert.match(searchStyles, /@media \(min-width: 72rem\)/);
  assert.doesNotMatch(search, /className="ui-row"/);
});

void test("Notifications V4 use contextual entities, material unread state and a bounded overlay", () => {
  assert.match(notifications, /NotificationVisual/);
  assert.match(notifications, /notificationVisualKind/);
  assert.match(notifications, /ui-visual-v4/);
  assert.doesNotMatch(notifications, /<Surface/);
  assert.match(notifications, /variant="quiet"/);
  assert.match(notificationStyles, /border-inline-start: 0\.25rem solid/);
  assert.match(notificationStyles, /home-empty-pitch\.webp/);
  assert.doesNotMatch(notifications, /className=.*ui-row/);
  assert.match(dropdown, /api\.notifications\(undefined, 5\)/);
  assert.match(dropdown, /unreadCount > 99 \? "99\+"/);
  assert.match(dropdown, /ui-notification-v4/);
  assert.match(dropdown, /<NotificationVisual compact item=\{item\}/);
  assert.match(dropdownStyles, /max-block-size: min\(26rem/);
  assert.match(dropdownStyles, /overflow-y: auto/);
});
