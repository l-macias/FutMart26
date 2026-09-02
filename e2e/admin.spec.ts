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
    await admin.goto(`http://127.0.0.1:3001/reports/${report.id}`);
    await admin
      .getByLabel("Motivo/resolución")
      .fill("Resolved by E2E operator");
    await admin.getByRole("button", { name: "Resolver" }).click();
    await expect(admin.getByText(/RESOLVED/)).toBeVisible();
    await admin.goto("http://127.0.0.1:3001/audit");
    await expect(admin.getByText(/REPORT_RESOLVED/)).toBeVisible();
    await adminContext.close();
  } finally {
    await reporter.api.dispose();
    await target.api.dispose();
    await operator.api.dispose();
  }
});
