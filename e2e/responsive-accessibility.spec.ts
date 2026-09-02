import { expect, test } from "@playwright/test";

import { applyApiSession, createReadyUser } from "./support/fixtures";

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

test("@critical mobile shell and avatar crop remain usable at 390px", async ({
  page,
}) => {
  const user = await createReadyUser("responsive");
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  try {
    await applyApiSession(user.api, page.context());
    await page.setViewportSize({ width: 390, height: 844 });

    for (const path of [
      "/",
      "/play",
      "/profile",
      "/players",
      "/rankings/global",
      "/notifications",
      "/invitations",
      "/profile/account",
    ]) {
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth,
          ),
        )
        .toBeTruthy();
    }

    await page.goto("/profile/edit");
    await expect(page.getByLabel("Sin foto")).toBeVisible();
    await page.getByLabel("Seleccionar foto").setInputFiles({
      name: "portrait.png",
      mimeType: "image/png",
      buffer: onePixelPng,
    });
    await expect(page.getByAltText("Vista previa del encuadre")).toBeVisible();
    await page.getByLabel("Encuadre horizontal").fill("0.25");
    await page.getByLabel("Encuadre vertical").fill("0.75");
    await page.getByLabel("Zoom").fill("1.5");
    await expect(
      page.getByRole("button", { name: "Guardar foto" }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Cancelar selección" }).click();
    await expect(page.getByLabel("Sin foto")).toBeVisible();

    await page.getByLabel("Seleccionar foto").setInputFiles({
      name: "too-large.png",
      mimeType: "image/png",
      buffer: Buffer.alloc(8 * 1024 * 1024 + 1),
    });
    await expect(
      page.getByText("La foto puede pesar hasta 8 MB."),
    ).toBeVisible();

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByLabel("Seleccionar foto").setInputFiles({
      name: "landscape.png",
      mimeType: "image/png",
      buffer: onePixelPng,
    });
    await expect(page.getByAltText("Vista previa del encuadre")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      )
      .toBeTruthy();
    expect(consoleErrors).toEqual([]);
  } finally {
    await user.api.dispose();
  }
});
