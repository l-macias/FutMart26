import { expect, test } from "@playwright/test";

import {
  applyApiSession,
  createGroup,
  createReadyUser,
  expectOk,
} from "./support/fixtures";

test("@critical notification preview and grouped global search share product state", async ({
  context,
  page,
}) => {
  const owner = await createReadyUser("notification-search-owner");
  const requester = await createReadyUser("notification-search-requester");
  const group = await createGroup(owner, `Club ${owner.name}`);
  await expectOk(
    requester.api.post("/me/connections/requests", {
      data: { playerId: owner.playerId },
    }),
  );
  await applyApiSession(owner.api, context);

  await page.goto("/");
  const bell = page.getByRole("button", { name: /Notificaciones/ });
  await bell.click();
  const preview = page.getByRole("region", {
    name: "Notificaciones recientes",
  });
  await expect(preview.getByText("Nueva solicitud de conexión")).toBeVisible();
  await preview
    .getByRole("button", { name: "Marcar todas como leídas" })
    .click();
  await expect(bell).toHaveAccessibleName("Notificaciones");
  await preview.getByRole("link", { name: "Ver todas" }).click();
  await expect(page).toHaveURL(/\/notifications$/);
  await expect(page.getByText("Nueva solicitud de conexión")).toBeVisible();

  await page.getByRole("link", { name: "Buscar jugadores o grupos" }).click();
  await expect(page).toHaveURL(/\/search$/);
  await page
    .getByRole("searchbox", { name: "Jugadores o grupos" })
    .fill(owner.name);
  await expect(page.getByRole("heading", { name: "Jugadores" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Grupos" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: new RegExp(group.name) }),
  ).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Notificaciones" }).click();
  await expect(
    page.getByRole("region", { name: "Notificaciones recientes" }),
  ).toBeVisible();

  await Promise.all([owner.api.dispose(), requester.api.dispose()]);
});
