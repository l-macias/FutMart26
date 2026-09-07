import { expect, test } from "@playwright/test";

import { createReadyUser, expectOk, grantSuperadmin } from "./support/fixtures";

test("@critical superadmin can resolve a report and a normal user is denied", async ({
  browser,
}) => {
  const reporter = await createReadyUser("reporter");
  const target = await createReadyUser("reported");
  const operator = await createReadyUser("operator");
  try {
    const reportResponse = await expectOk(
      reporter.api.post("/reports", {
        data: {
          targetType: "PLAYER",
          targetId: target.playerId,
          reason: "OTHER",
          comment: "E2E operational review",
        },
      }),
    );
    const report = (await reportResponse.json()) as { id: string };

    const deniedContext = await browser.newContext();
    const denied = await deniedContext.newPage();
    await denied.goto("http://127.0.0.1:3001");
    await denied.getByLabel("Email").fill(reporter.email);
    await denied.getByLabel("Contraseña").fill(reporter.password);
    await denied.getByRole("button", { name: "Ingresar" }).click();
    await expect(
      denied.getByRole("heading", { name: "Acceso denegado" }),
    ).toBeVisible();
    await deniedContext.close();

    await grantSuperadmin(operator.email);
    const adminContext = await browser.newContext();
    const admin = await adminContext.newPage();
    await admin.goto("http://127.0.0.1:3001");
    await admin.getByLabel("Email").fill(operator.email);
    await admin.getByLabel("Contraseña").fill(operator.password);
    await admin.getByRole("button", { name: "Ingresar" }).click();
    await expect(admin.getByRole("heading", { name: "Resumen" })).toBeVisible();
    await admin.getByRole("link", { name: "Jugadores" }).click();
    await admin.getByLabel("Buscar jugadores").fill(target.name);
    await admin.getByRole("link", { name: target.name }).click();
    await expect(
      admin.getByRole("heading", { name: target.name }),
    ).toBeVisible();
    await admin.getByLabel("Motivo").fill("E2E reversible moderation check");
    await admin.getByRole("button", { name: "Suspender cuenta" }).click();
    await admin.getByRole("button", { name: "Confirmar" }).click();
    await expect(
      admin.getByText("Acción registrada en Auditoría."),
    ).toBeVisible();
    await admin.getByLabel("Motivo").fill("E2E restores the test account");
    await admin.getByRole("button", { name: "Reactivar cuenta" }).click();
    await admin.getByRole("button", { name: "Confirmar" }).click();
    await expect(
      admin.getByText("Acción registrada en Auditoría."),
    ).toBeVisible();
    await admin.goto(`http://127.0.0.1:3001/reports/${report.id}`);
    await admin
      .getByLabel("Motivo y resolución")
      .fill("Resolved by E2E operator");
    await admin.getByRole("button", { name: "Resolver" }).click();
    await admin.getByRole("button", { name: "Confirmar" }).click();
    await expect(admin.getByText(/RESUELTO/)).toBeVisible();
    await admin.goto("http://127.0.0.1:3001/system");
    await expect(admin.getByRole("heading", { name: "Sistema" })).toBeVisible();
    await admin.goto("http://127.0.0.1:3001/audit");
    await expect(
      admin.getByText("Reporte resuelto", { exact: true }),
    ).toBeVisible();
    await adminContext.close();
  } finally {
    await reporter.api.dispose();
    await target.api.dispose();
    await operator.api.dispose();
  }
});
