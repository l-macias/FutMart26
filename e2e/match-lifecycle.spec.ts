import { expect, test } from "@playwright/test";

import {
  applyApiSession,
  createGroup,
  createFinishedMatch,
  createReadyUser,
  expectOk,
  joinGroup,
} from "./support/fixtures";

test("@critical Match Detail changes information architecture from OPEN to STARTED", async ({
  page,
}) => {
  const owner = await createReadyUser("match-ia-owner");
  const member = await createReadyUser("match-ia-member");
  try {
    const group = await createGroup(owner);
    await joinGroup(owner, member, group.id);
    const created = await expectOk(
      owner.api.post(`/groups/${group.id}/matches`, {
        data: {
          discipline: "F5",
          scheduledAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
          durationMinutes: 60,
          capacity: 2,
          locationText: "Cancha IA E2E",
        },
      }),
    );
    const match = (await created.json()) as { id: string };
    await expectOk(owner.api.post(`/matches/${match.id}/publish`));
    await expectOk(owner.api.post(`/matches/${match.id}/join`));
    await expectOk(member.api.post(`/matches/${match.id}/join`));
    await applyApiSession(owner.api, page.context());
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto(`/groups/${group.id}`);
    await expect(page.getByRole("heading", { name: group.name })).toBeVisible();
    await expect(page.getByText("PRÓXIMO PARTIDO")).toBeVisible();
    await expect(page.getByText("PLANTEL · 2")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Administrar grupo" }),
    ).toBeVisible();
    await expect(page.getByText("SUMAR JUGADORES")).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      )
      .toBeTruthy();

    await page.goto(`/groups/${group.id}/settings`);
    await expect(page.getByText("GENERAL", { exact: true })).toBeVisible();
    await expect(page.getByText("MIEMBROS", { exact: true })).toBeVisible();
    await expect(page.getByText("INVITACIONES", { exact: true })).toBeVisible();
    await expect(page.getByText("INVITADOS", { exact: true })).toBeVisible();
    await expect(page.getByText("PROPIEDAD", { exact: true })).toBeVisible();
    await expect(
      page.getByText("ZONA DE RIESGO", { exact: true }),
    ).toBeVisible();

    await page.goto(`/play/matches/${match.id}`);
    await expect(page.getByText("TU ESTADO")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "CONFIRMADOS · 2" }),
    ).toBeVisible();
    const openManagement = page
      .locator("details")
      .filter({ hasText: "ADMINISTRAR PARTIDO · CONVOCATORIA" });
    await openManagement
      .getByText("ADMINISTRAR PARTIDO · CONVOCATORIA")
      .click();
    await expect(
      openManagement.getByText("DATOS", { exact: true }),
    ).toBeVisible();
    await expect(
      openManagement.getByText("PARTICIPANTES", { exact: true }),
    ).toBeVisible();
    await expect(
      openManagement.getByText("EQUIPOS", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Cancelar partido" }).click();
    const cancelDialog = page.getByRole("dialog");
    await expect(
      cancelDialog.getByRole("heading", { name: "¿Cancelar este partido?" }),
    ).toBeVisible();
    await cancelDialog
      .getByRole("button", { name: "Cancelar", exact: true })
      .click();
    await expect(
      page.locator(
        'a[href^="/rankings/venues/"], a[href^="/rankings/cities/"]',
      ),
    ).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      )
      .toBeTruthy();

    await expectOk(owner.api.post(`/matches/${match.id}/teams/generate`));
    await expectOk(owner.api.post(`/matches/${match.id}/start`));
    await page.reload();
    await expect(page.getByText("EN JUEGO", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "EQUIPO A" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "EQUIPO B" })).toBeVisible();
    await expect(page.getByText("TU ESTADO")).toHaveCount(0);
    await expect(page.getByText(/EN ESPERA/)).toHaveCount(0);
    await expect(page.getByText(/CONVOCATORIA/)).toHaveCount(0);
    await page.getByText("ADMINISTRAR PARTIDO · EN JUEGO").click();
    await expect(page.getByText("ASISTENCIA", { exact: true })).toBeVisible();
    await expect(
      page.getByText("RESULTADO Y EVENTOS", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("CIERRE", { exact: true })).toBeVisible();
  } finally {
    await owner.api.dispose();
    await member.api.dispose();
  }
});

test("@critical group and match lifecycle reaches FINISHED", async ({
  page,
}) => {
  const owner = await createReadyUser("owner");
  const member = await createReadyUser("member");
  try {
    const { group, match } = await createFinishedMatch(owner, member);
    await applyApiSession(owner.api, page.context());
    await page.goto(`/play/matches/${match.id}`);
    await expect(
      page.getByText("Finalizado", { exact: false }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("Cancha E2E", { exact: false }).first(),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "VOTAR AHORA" })).toBeVisible();

    await page.goto(`/groups/${group.id}/settings`);
    await page.getByLabel("Nombre del grupo").fill("Grupo renombrado E2E");
    await page.getByRole("button", { name: "Guardar nombre" }).click();
    await expect(page.getByRole("status")).toContainText("Cambios guardados");
    await expect(
      page.getByRole("heading", { name: "Grupo renombrado E2E" }),
    ).toBeVisible();
  } finally {
    await owner.api.dispose();
    await member.api.dispose();
  }
});

test("@critical finished Match does not request private progression for a non-participant", async ({
  page,
}) => {
  const owner = await createReadyUser("summary-owner");
  const participant = await createReadyUser("summary-player");
  const observer = await createReadyUser("summary-observer");
  try {
    const { group, match } = await createFinishedMatch(owner, participant);
    await joinGroup(owner, observer, group.id);
    await applyApiSession(observer.api, page.context());
    const revealRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes(`/matches/${match.id}/progression/reveal`))
        revealRequests.push(request.url());
    });
    await page.goto(`/play/matches/${match.id}`);
    await expect(page.getByText("PLANILLA DEL PARTIDO")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /VER MI PROGRESIÓN/i }),
    ).toHaveCount(0);
    expect(revealRequests).toHaveLength(0);
  } finally {
    await owner.api.dispose();
    await participant.api.dispose();
    await observer.api.dispose();
  }
});
