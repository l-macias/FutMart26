import { expect, test } from "@playwright/test";

import {
  applyApiSession,
  createFinishedMatch,
  createReadyUser,
  expectOk,
} from "./support/fixtures";

test("@critical voting closes and progression appears in reveal/history", async ({
  page,
}) => {
  const owner = await createReadyUser("voter-owner");
  const member = await createReadyUser("voter-member");
  try {
    const { match } = await createFinishedMatch(owner, member);
    for (const user of [owner, member]) {
      const votingResponse = await expectOk(
        user.api.get(`/matches/${match.id}/voting`),
      );
      const voting = (await votingResponse.json()) as {
        eligibleTargets: { participantId: string }[];
      };
      await expectOk(
        user.api.post(`/matches/${match.id}/voting/ballot`, {
          data: {
            mode: "QUICK",
            evaluations: voting.eligibleTargets.slice(0, 1).map((target) => ({
              targetParticipantId: target.participantId,
              rating: 8,
              quickSignal: "POSITIVE",
            })),
          },
        }),
      );
    }
    await expectOk(
      owner.api.post(`/matches/${match.id}/progression/materialize`),
    );
    await applyApiSession(owner.api, page.context());
    await page.goto(`/play/matches/${match.id}/progression`);
    await expect(
      page.getByText(/OVR|PROGRESIÓN|EVIDENCIA/i).first(),
    ).toBeVisible();
    await page.goto("/profile/progression");
    await expect(
      page.getByRole("link", { name: /Ver reveal/i }).first(),
    ).toBeVisible();
  } finally {
    await owner.api.dispose();
    await member.api.dispose();
  }
});
