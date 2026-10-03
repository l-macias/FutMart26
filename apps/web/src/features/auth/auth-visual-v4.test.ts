import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function read(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const auth = read("./auth-screen.tsx");
const authStyles = read("./auth-screen.module.css");
const flows = read("./auth-flow-screen.tsx");
const flowStyles = read("./auth-flow.module.css");
const scene = read("./auth-visual-scene.tsx");
const sceneStyles = read("./auth-visual-scene.module.css");

void test("Auth V4 uses a cinematic football shell instead of a centered generic form", () => {
  assert.match(auth, /ui-visual-v4/);
  assert.match(auth, /<AuthVisualScene/);
  assert.match(scene, /FIFAR/);
  assert.match(scene, /player-portrait-01\.webp/);
  assert.match(sceneStyles, /players-tunnel\.webp/);
  assert.match(authStyles, /grid-template-columns: minmax\(0, 1\.25fr\)/);
  assert.match(authStyles, /@media \(max-width: 47\.99rem\)/);
  assert.doesNotMatch(authStyles, /\.page\s*\{[^}]*place-items:\s*center/s);
  assert.equal(
    existsSync(
      new URL(
        "../../../public/fifar-v4/backgrounds-raster/players-tunnel.webp",
        import.meta.url,
      ),
    ),
    true,
  );
});

void test("Login and register preserve auth behavior and legal destinations", () => {
  assert.match(auth, /authClient\.signIn\.email/);
  assert.match(auth, /authClient\.signUp\.email/);
  assert.match(auth, /router\.replace\(returnTo\)/);
  assert.match(auth, /minLength=\{8\}/);
  assert.match(auth, /maxLength=\{128\}/);
  assert.match(auth, /href="\/terms"/);
  assert.match(auth, /href="\/privacy"/);
  assert.match(auth, /"current-password"/);
  assert.match(auth, /"new-password"/);
});

void test("Recovery and verification flows share V4 without changing security semantics", () => {
  assert.match(flows, /ui-visual-v4/);
  assert.match(flows, /<AuthVisualScene/);
  assert.match(flows, /authClient\.requestPasswordReset/);
  assert.match(flows, /authClient\.resetPassword/);
  assert.match(flows, /authClient\.sendVerificationEmail/);
  assert.match(flows, /Las contraseñas no coinciden/);
  assert.match(flowStyles, /inputShell/);
  assert.match(flowStyles, /@media \(max-width: 47\.99rem\)/);
});
