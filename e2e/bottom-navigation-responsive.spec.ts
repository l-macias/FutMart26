import { expect, test } from "@playwright/test";

import {
  applyApiSession,
  createGroup,
  createReadyUser,
  expectOk,
} from "./support/fixtures";

test("mobile bottom navigation reaches the viewport edge without covering content", async ({
  page,
}) => {
  const owner = await createReadyUser("bottom-nav");

  try {
    const group = await createGroup(owner);
    const created = await expectOk(
      owner.api.post(`/groups/${group.id}/matches`, {
        data: {
          discipline: "F5",
          scheduledAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
          durationMinutes: 60,
          capacity: 10,
          locationText: "Cancha Bottom Nav",
        },
      }),
    );
    const match = (await created.json()) as { id: string };
    await expectOk(owner.api.post(`/matches/${match.id}/publish`));
    await applyApiSession(owner.api, page.context());

    const routes = [
      "/",
      "/play",
      "/groups",
      "/rankings",
      "/profile",
      "/search",
      "/notifications",
      `/play/matches/${match.id}`,
    ];

    for (const viewport of [
      { width: 390, height: 667 },
      { width: 390, height: 844 },
      { width: 430, height: 932 },
    ]) {
      await page.setViewportSize(viewport);

      for (const route of routes) {
        await page.goto(route);
        const navigation = page.getByRole("navigation", {
          name: "Navegación principal",
        });
        await expect(navigation).toBeVisible();

        const geometry = await navigation.evaluate((element) => {
          const navigationRect = element.getBoundingClientRect();
          const shell = element.parentElement?.parentElement;
          const shellPaddingBottom = shell
            ? Number.parseFloat(getComputedStyle(shell).paddingBottom)
            : 0;
          return {
            bottomDelta: Math.abs(window.innerHeight - navigationRect.bottom),
            navigationHeight: navigationRect.height,
            shellPaddingBottom,
            hasHorizontalOverflow:
              document.documentElement.scrollWidth >
              document.documentElement.clientWidth,
          };
        });

        expect(geometry.bottomDelta).toBeLessThanOrEqual(1);
        expect(geometry.shellPaddingBottom + 1).toBeGreaterThanOrEqual(
          geometry.navigationHeight,
        );
        expect(geometry.hasHorizontalOverflow).toBe(false);
      }
    }

    for (const viewport of [
      { width: 768, height: 900 },
      { width: 1024, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/");
      const navigation = page.getByRole("navigation", {
        name: "Navegación principal",
      });
      await expect(navigation).toBeVisible();
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
  } finally {
    await owner.api.dispose();
  }
});
