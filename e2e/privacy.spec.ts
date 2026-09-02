import { expect, test } from "@playwright/test";

import {
  applyApiSession,
  createGroup,
  createReadyUser,
  expectOk,
  joinGroup,
} from "./support/fixtures";

test("@critical private player leaves discovery but remains in shared Group context", async ({
  page,
}) => {
  const owner = await createReadyUser("privacy-owner");
  const player = await createReadyUser("privacy-target");
  try {
    const group = await createGroup(owner);
    await joinGroup(owner, player, group.id);
    await expectOk(
      player.api.patch("/me/player/privacy", {
        data: { profileVisibility: "PRIVATE" },
      }),
    );
    const search = await expectOk(
      owner.api.get(
        `/search?q=${encodeURIComponent(player.name.slice(0, 12))}&limit=10`,
      ),
    );
    const searchBody = (await search.json()) as { players: { id: string }[] };
    expect(
      searchBody.players.some((item) => item.id === player.playerId),
    ).toBeFalsy();
    const members = await expectOk(
      owner.api.get(`/groups/${group.id}/members`),
    );
    expect(await members.text()).toContain(player.playerId);

    await applyApiSession(owner.api, page.context());
    await page.goto(`/players/${player.playerId}`);
    await expect(page.getByText("PERFIL PRIVADO")).toBeVisible();
  } finally {
    await owner.api.dispose();
    await player.api.dispose();
  }
});
