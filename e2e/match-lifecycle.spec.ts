import { expect, test } from "@playwright/test";

import {
  applyApiSession,
  createFinishedMatch,
  createReadyUser,
} from "./support/fixtures";

test("@critical group and match lifecycle reaches FINISHED", async ({
  page,
}) => {
  const owner = await createReadyUser("owner");
  const member = await createReadyUser("member");
  try {
    const { match } = await createFinishedMatch(owner, member);
    await applyApiSession(owner.api, page.context());
    await page.goto(`/play/matches/${match.id}`);
    await expect(
      page.getByText("Finalizado", { exact: false }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("Cancha E2E", { exact: false }).first(),
    ).toBeVisible();
  } finally {
    await owner.api.dispose();
    await member.api.dispose();
  }
});
