import { expect, test } from "@playwright/test";

import {
  applyApiSession,
  createGroup,
  createReadyUser,
  expectOk,
  joinGroup,
} from "./support/fixtures";

test("Match OPEN keeps recruitment messaging and admission actions consistent", async ({
  page,
}) => {
  const owner = await createReadyUser("open-cta-owner");
  const member = await createReadyUser("open-cta-member");

  try {
    const group = await createGroup(owner);
    await joinGroup(owner, member, group.id);

    const pausedRecruitmentResponse = await expectOk(
      owner.api.post(`/groups/${group.id}/matches`, {
        data: {
          discipline: "F5",
          scheduledAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
          durationMinutes: 60,
          capacity: 2,
          locationText: "Cancha Recruitment Pausado",
        },
      }),
    );
    const pausedRecruitment = (await pausedRecruitmentResponse.json()) as {
      id: string;
    };
    await expectOk(owner.api.post(`/matches/${pausedRecruitment.id}/publish`));

    await applyApiSession(member.api, page.context());
    await page.goto(`/play/matches/${pausedRecruitment.id}`);
    await expect(page.getByText("Búsqueda de jugadores pausada")).toBeVisible();
    await expect(page.getByText("Convocatoria cerrada")).toHaveCount(0);
    const joinAction = page.getByRole("button", { name: "Anotarme" });
    await expect(joinAction).toBeEnabled();
    await expect(joinAction).toHaveCount(1);
    await joinAction.click();
    await expect(
      page.getByRole("heading", { name: /Estás confirmado/ }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Anotarme" })).toHaveCount(0);

    const fullResponse = await expectOk(
      owner.api.post(`/groups/${group.id}/matches`, {
        data: {
          discipline: "F5",
          scheduledAt: new Date(Date.now() + 48 * 60 * 60_000).toISOString(),
          durationMinutes: 60,
          capacity: 1,
          locationText: "Cancha Lista de Espera",
        },
      }),
    );
    const full = (await fullResponse.json()) as { id: string };
    await expectOk(owner.api.post(`/matches/${full.id}/publish`));
    await expectOk(
      owner.api.put(`/matches/${full.id}/recruitment`, {
        data: { enabled: true, needs: [] },
      }),
    );
    await expectOk(owner.api.post(`/matches/${full.id}/join`));

    await page.goto(`/play/matches/${full.id}`);
    await expect(
      page.getByText("Cupo completo · lista de espera disponible"),
    ).toBeVisible();
    const waitlistAction = page.getByRole("button", {
      name: "Sumarme a la lista de espera",
    });
    await expect(waitlistAction).toBeEnabled();
    await expect(waitlistAction).toHaveCount(1);
    await waitlistAction.click();
    await expect(
      page.getByRole("heading", { name: /Estás en espera/ }),
    ).toBeVisible();
    await expect(waitlistAction).toHaveCount(0);
  } finally {
    await owner.api.dispose();
    await member.api.dispose();
  }
});
