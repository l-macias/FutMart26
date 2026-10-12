import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  applyApiSession,
  createGroup,
  createReadyUser,
  expectOk,
} from "./support/fixtures";

const viewports = [390, 430, 768, 1024, 1280, 1440, 1920] as const;

test("Batch 4 surfaces preserve actions and collision-free responsive geometry", async ({
  context,
  page,
}) => {
  test.setTimeout(120_000);
  const owner = await createReadyUser(
    "group-roster-player-with-an-intentionally-very-long-name",
  );
  const connected = await createReadyUser("visual-batch4-connected");
  const requester = await createReadyUser("visual-batch4-requester");
  const group = await createGroup(
    owner,
    "Asociaci\u00f3n Deportiva del Barrio con un Nombre Extraordinariamente Largo",
  );

  try {
    await expectOk(
      connected.api.post("/me/connections/requests", {
        data: { playerId: owner.playerId },
      }),
    );
    await expectOk(
      owner.api.post(`/me/connections/${connected.playerId}/accept`),
    );
    await expectOk(
      requester.api.post("/me/connections/requests", {
        data: { playerId: connected.playerId },
      }),
    );
    await expectOk(
      owner.api.post(`/groups/${group.id}/connection-invitations`, {
        data: { playerId: connected.playerId },
      }),
    );

    await applyApiSession(owner.api, context);
    for (const width of viewports) {
      await setViewport(page, width);
      await page.goto("/groups");
      const groupLink = page.getByRole("link", {
        name: new RegExp(group.name),
      });
      await expect(groupLink).toBeVisible();
      await expectContainedText(
        groupLink.getByText(group.name, { exact: true }),
      );
      await expectNoDocumentOverflow(page);
      await capture(page, `groups-${width}`);

      await page.goto(`/groups/${group.id}`);
      const rosterName = page.getByText(owner.name, { exact: true }).last();
      await expect(rosterName).toBeVisible();
      await expectContainedText(rosterName);
      await expectNoDocumentOverflow(page);
      await capture(page, `group-roster-${width}`);
    }

    await context.clearCookies();
    await applyApiSession(connected.api, context);
    const longQuery =
      "jugador inexistente con una b\u00fasqueda deliberadamente muy extensa";

    for (const width of viewports) {
      await setViewport(page, width);
      await page.goto(`/search?q=${encodeURIComponent(longQuery)}`);
      const searchHeader = page.locator('[class*="discoveryHeader"]');
      const headerCopy = page.locator('[class*="headerCopy"]');
      const searchForm = page.getByRole("search");
      const emptyState = page.locator('[class*="discoveryState"]').first();
      const emptyHeading = page.getByRole("heading", {
        name: "Sin coincidencias",
      });
      const emptyDescription = page.getByText(
        new RegExp("No encontramos jugadores o grupos"),
      );
      const emptyPortrait = page
        .locator('[class*="discoveryEntities"] [class*="portrait"]')
        .first();
      await expect(emptyHeading).toBeVisible();
      await expect(emptyDescription).toBeVisible();
      await expect(emptyPortrait).toBeVisible();
      await expectInViewport(searchHeader, page);
      await expectContainedBy(searchForm, searchHeader);
      await expectNoOverlap(headerCopy, searchForm);
      await expectInViewport(emptyState, page);
      await expectContainedBy(emptyHeading, emptyState);
      await expectNoOverlap(emptyHeading, emptyPortrait);
      await expectContainedText(emptyDescription);
      await expectNoDocumentOverflow(page);
      await expectContainedBy(emptyDescription, emptyState);
      await capture(page, `search-empty-${width}`);

      await page.goto("/connections");
      await expect(
        page.getByRole("heading", { name: "Conexiones", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: new RegExp(owner.name) }).first(),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Aceptar" })).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Rechazar" }),
      ).toBeVisible();
      await expectNoDocumentOverflow(page);
      await capture(page, `connections-${width}`);

      await page.goto("/invitations");
      await expect(
        page.getByRole("heading", { name: "Invitaciones", exact: true }),
      ).toBeVisible();
      await expect(page.getByText(group.name, { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Aceptar" })).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Rechazar" }),
      ).toBeVisible();
      await expectNoDocumentOverflow(page);
      await capture(page, `invitations-${width}`);

      await page.goto("/notifications");
      const notificationTitle = page.getByRole("heading", {
        name: "Notificaciones",
        exact: true,
      });
      await expect(notificationTitle).toBeVisible();
      await expectContainedText(notificationTitle);
      await expectNoDocumentOverflow(page);
      await capture(page, `notifications-${width}`);
    }
  } finally {
    await Promise.all([
      owner.api.dispose(),
      connected.api.dispose(),
      requester.api.dispose(),
    ]);
  }
});

async function setViewport(page: Page, width: number) {
  await page.setViewportSize({
    width,
    height: width < 768 ? 844 : 960,
  });
}

async function expectNoDocumentOverflow(page: Page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
}

async function expectContainedText(locator: Locator) {
  expect(
    await locator.evaluate(
      (element) => element.scrollWidth <= element.clientWidth + 1,
    ),
  ).toBe(true);
}

async function expectContainedBy(child: Locator, parent: Locator) {
  const childBox = await child.boundingBox();
  const parentBox = await parent.boundingBox();
  expect(childBox).not.toBeNull();
  expect(parentBox).not.toBeNull();
  expect(childBox!.x).toBeGreaterThanOrEqual(parentBox!.x - 1);
  expect(childBox!.y).toBeGreaterThanOrEqual(parentBox!.y - 1);
  expect(childBox!.x + childBox!.width).toBeLessThanOrEqual(
    parentBox!.x + parentBox!.width + 1,
  );
  expect(childBox!.y + childBox!.height).toBeLessThanOrEqual(
    parentBox!.y + parentBox!.height + 1,
  );
}

async function expectInViewport(locator: Locator, page: Page) {
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
}

async function expectNoOverlap(first: Locator, second: Locator) {
  const firstBox = await first.boundingBox();
  const secondBox = await second.boundingBox();
  expect(firstBox).not.toBeNull();
  expect(secondBox).not.toBeNull();
  expect(
    firstBox!.x < secondBox!.x + secondBox!.width &&
      firstBox!.x + firstBox!.width > secondBox!.x &&
      firstBox!.y < secondBox!.y + secondBox!.height &&
      firstBox!.y + firstBox!.height > secondBox!.y,
  ).toBe(false);
}

async function capture(page: Page, name: string) {
  if (process.env.VISUAL_BATCH4_SCREENSHOTS !== "true") return;
  await page.screenshot({
    path: `.runtime/visual-batch4/${name}.png`,
    fullPage: true,
  });
}
