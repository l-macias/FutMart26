import { expect, test, type Locator, type Page } from "@playwright/test";

import { applyApiSession, createReadyUser } from "./support/fixtures";

const rankingResponse = {
  scope: { type: "GLOBAL", label: "Global" },
  discipline: "F5",
  items: [
    rankingItem(1, "Mateo Campeón", "92.00"),
    rankingItem(2, "Valentina Subcampeona", "88.00"),
    rankingItem(3, "Santiago Tercero", "84.00"),
    rankingItem(4, "Jugador actual con nombre extenso", "79.00", true),
    rankingItem(5, "Camila Quinta", "76.00"),
    rankingItem(6, "Franco Sexto", "73.00"),
  ],
  me: {
    ranked: true,
    position: 4,
    overall: "79.00",
    processedMatchCount: 12,
  },
  nextCursor: null,
} as const;

const viewports = [390, 430, 768, 1024, 1280, 1440, 1920] as const;

test("Rankings preserves Top 3 order and collision-free responsive geometry", async ({
  page,
}) => {
  const user = await createReadyUser("rankings-responsive");

  try {
    await applyApiSession(user.api, page.context());
    await mockGlobalRanking(page);

    for (const width of viewports) {
      await page.setViewportSize({
        width,
        height: width < 768 ? 844 : 960,
      });
      await page.goto("/rankings?scope=global");

      const heading = page.getByRole("heading", {
        name: "Rankings",
        exact: true,
      });
      const topThree = page.getByRole("region", { name: "Top 3" });
      const currentUser = page.getByRole("region", { name: "TU POSICIÓN" });
      const classification = page.getByRole("region", {
        name: "Competidores",
      });
      const classificationHeading = page.getByRole("heading", {
        name: "Competidores",
        exact: true,
      });

      await expect(heading).toBeVisible();
      await expect(topThree).toBeVisible();
      await expect(currentUser).toBeVisible();
      await expect(classification).toBeVisible();

      for (const player of rankingResponse.items.slice(0, 3)) {
        await expect(
          topThree.getByText(player.player.displayName, { exact: true }),
        ).toHaveCount(1);
        await expect(
          classification.getByText(player.player.displayName, { exact: true }),
        ).toHaveCount(0);
      }
      await expect(
        classification.getByText(rankingResponse.items[3].player.displayName, {
          exact: true,
        }),
      ).toBeVisible();

      const classificationHandle = await classification.elementHandle();
      expect(classificationHandle).not.toBeNull();
      expect(
        await topThree.evaluate(
          (top, list) =>
            Boolean(
              top.compareDocumentPosition(list) &
              Node.DOCUMENT_POSITION_FOLLOWING,
            ),
          classificationHandle,
        ),
      ).toBeTruthy();

      const topBox = await requiredBox(topThree);
      const currentBox = await requiredBox(currentUser);
      const listBox = await requiredBox(classification);
      const identity = currentUser.getByText("TU POSICIÓN").locator("..");
      const tier = currentUser.locator("[data-tier]");
      const identityBox = await requiredBox(identity);
      const tierBox = await requiredBox(tier);

      expect(rectanglesOverlap(identityBox, tierBox)).toBeFalsy();
      expect(isContained(identityBox, currentBox)).toBeTruthy();
      expect(isContained(tierBox, currentBox)).toBeTruthy();

      if (width >= 1280) {
        expect(topBox.y).toBeLessThan(listBox.y);
        expect(currentBox.x).toBeGreaterThan(topBox.x + topBox.width - 2);
      } else {
        expect(topBox.y + topBox.height).toBeLessThanOrEqual(currentBox.y + 2);
        expect(currentBox.y + currentBox.height).toBeLessThanOrEqual(
          listBox.y + 2,
        );
      }

      if (width === 768) {
        expect(topBox.width).toBeGreaterThan(480);
        expect(currentBox.width).toBeGreaterThan(480);
        expect(listBox.width).toBeGreaterThan(480);
        expect(currentBox.height).toBeLessThan(240);
      }

      expect(
        await heading.evaluate(
          (element) => element.scrollWidth <= element.clientWidth + 1,
        ),
      ).toBeTruthy();
      expect(
        await classificationHeading.evaluate((element) => {
          const lineHeight = Number.parseFloat(
            window.getComputedStyle(element).lineHeight,
          );
          return (
            element.scrollWidth <= element.clientWidth + 1 &&
            element.getBoundingClientRect().height <= lineHeight * 1.2
          );
        }),
      ).toBeTruthy();
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      ).toBeTruthy();
      if (process.env.RANKINGS_SCREENSHOTS === "true") {
        await page.screenshot({
          path: ".runtime/rankings-fix/rankings-" + width + ".png",
          fullPage: true,
        });
      }
    }
  } finally {
    await user.api.dispose();
  }
});

function rankingItem(
  position: number,
  displayName: string,
  overall: string,
  isCurrentPlayer = false,
) {
  return {
    position,
    player: {
      id: `00000000-0000-4000-8000-${String(position).padStart(12, "0")}`,
      displayName,
    },
    performance: {
      overall,
      processedMatchCount: 12,
    },
    isCurrentPlayer,
  };
}

async function mockGlobalRanking(page: Page) {
  await page.route("**/rankings/global/F5?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": "http://127.0.0.1:3000",
        "access-control-allow-credentials": "true",
      },
      body: JSON.stringify(rankingResponse),
    });
  });
}

async function requiredBox(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

function rectanglesOverlap(
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number },
) {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

function isContained(
  inner: { x: number; y: number; width: number; height: number },
  outer: { x: number; y: number; width: number; height: number },
) {
  const tolerance = 2;
  return (
    inner.x >= outer.x - tolerance &&
    inner.y >= outer.y - tolerance &&
    inner.x + inner.width <= outer.x + outer.width + tolerance &&
    inner.y + inner.height <= outer.y + outer.height + tolerance
  );
}
