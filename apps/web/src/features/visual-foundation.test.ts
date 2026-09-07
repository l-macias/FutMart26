import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
