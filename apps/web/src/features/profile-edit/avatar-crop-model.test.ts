import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { avatarCropRectangle } from "@football/contracts";

import { avatarCropAfterDrag } from "./avatar-crop-model";

void test("pointer drag updates normalized crop consistently across viewports", () => {
  const image = { width: 1600, height: 900 };
  const crop = { cropX: 0.5, cropY: 0.5, zoom: 2 };
  const mobile = avatarCropAfterDrag(image, crop, {
    deltaX: 39,
    deltaY: -78,
    viewportWidth: 390,
    viewportHeight: 487.5,
  });
  const desktop = avatarCropAfterDrag(image, crop, {
    deltaX: 144,
    deltaY: -288,
    viewportWidth: 1440,
    viewportHeight: 1800,
  });
  assert.ok(Math.abs(mobile.cropX - desktop.cropX) < 0.000_001);
  assert.ok(Math.abs(mobile.cropY - desktop.cropY) < 0.000_001);
  assert.ok(mobile.cropX < crop.cropX);
  assert.ok(mobile.cropY > crop.cropY);
});

void test("pointer drag clamps the crop so the aperture never exposes empty space", () => {
  const image = { width: 900, height: 1600 };
  const crop = avatarCropAfterDrag(
    image,
    { cropX: 0.5, cropY: 0.5, zoom: 1.5 },
    {
      deltaX: -100_000,
      deltaY: 100_000,
      viewportWidth: 390,
      viewportHeight: 487.5,
    },
  );
  const rectangle = avatarCropRectangle(image.width, image.height, crop);
  assert.equal(rectangle.left + rectangle.width <= image.width, true);
  assert.equal(rectangle.top + rectangle.height <= image.height, true);
  assert.equal(rectangle.left >= 0, true);
  assert.equal(rectangle.top >= 0, true);
});

void test("real Player Card portraits keep the saved framing without a second zoom", () => {
  const css = readFileSync(
    new URL(
      "../../components/player-card/player-card.module.css",
      import.meta.url,
    ),
    "utf8",
  );
  const card = readFileSync(
    new URL("../../components/player-card/player-card.tsx", import.meta.url),
    "utf8",
  );
  assert.match(card, /className=\{styles\.playerPhoto\}/);
  assert.match(
    css,
    /\.playerPhoto\s*\{[^}]*object-position:\s*50% 50%;[^}]*transform:\s*none;/s,
  );
  assert.match(
    css,
    /\.playerSilhouette\s*\{[^}]*transform:\s*scale\(1\.09\);/s,
  );
  assert.doesNotMatch(css, /\.artworkLayer > img/);
});

void test("profile editor keeps pointer and keyboard crop controls", () => {
  const screen = readFileSync(
    new URL("./profile-edit-screen.tsx", import.meta.url),
    "utf8",
  );
  assert.match(screen, /onPointerDown=\{pointerDown\}/);
  assert.match(screen, /onPointerMove=\{pointerMove\}/);
  assert.match(screen, /setPointerCapture/);
  assert.match(screen, /Editar encuadre/);
  assert.match(screen, /<RangeControl/);
  assert.match(screen, /expectedRevision/);
});
