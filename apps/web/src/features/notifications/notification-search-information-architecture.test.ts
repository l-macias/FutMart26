import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dropdown = readFileSync(
  new URL("./notification-dropdown.tsx", import.meta.url),
  "utf8",
);
const inbox = readFileSync(
  new URL("./notifications-screen.tsx", import.meta.url),
  "utf8",
);
const search = readFileSync(
  new URL("../player-discovery/player-discovery-screen.tsx", import.meta.url),
  "utf8",
);
const shell = readFileSync(
  new URL("../../components/app-shell/app-shell.tsx", import.meta.url),
  "utf8",
);

void test("header notification preview is bounded and shares inbox state", () => {
  assert.equal(dropdown.includes("api.notifications(undefined, 5)"), true);
  assert.equal(dropdown.includes("api.markAllNotificationsRead"), true);
  assert.equal(dropdown.includes("refreshNotificationState"), true);
  assert.equal(dropdown.includes('href="/notifications"'), true);
  assert.equal(dropdown.includes('event.key !== "Escape"'), true);
  assert.equal(shell.includes("<NotificationDropdown"), true);
  assert.equal(shell.includes('href="/notifications"'), false);
});

void test("full inbox keeps bounded history and supports unread operations", () => {
  assert.equal(
    inbox.includes("api.notifications(pageParam ?? undefined, 20"),
    true,
  );
  assert.equal(inbox.includes("notificationInbox(unreadOnly)"), true);
  assert.equal(inbox.includes("api.markNotificationRead"), true);
  assert.equal(inbox.includes("api.markAllNotificationsRead"), true);
  assert.equal(inbox.includes("Todas"), true);
  assert.equal(inbox.includes("No leídas"), true);
});

void test("global search is grouped, debounced and routes only authorized groups", () => {
  assert.equal(search.includes("SEARCH_DELAY_MS = 300"), true);
  assert.equal(search.includes("queryFn: ({ signal })"), true);
  assert.equal(search.includes("api.globalSearch(query, 5, signal)"), true);
  assert.equal(search.includes("Jugadores"), true);
  assert.equal(search.includes("Grupos"), true);
  assert.equal(search.includes("group.target ?"), true);
  assert.equal(search.includes("href={`/players/${item.player.id}`}"), true);
  assert.equal(shell.includes('href="/search"'), true);
});
