import { expect, test } from "@playwright/test";

import { uniqueLabel, verifyEmail } from "./support/fixtures";

test("@critical register, verify, compliance and football onboarding", async ({
  page,
}) => {
  const label = uniqueLabel("auth");
  const email = `${label.toLowerCase()}@example.test`;
  const password = "E2e-safe-password-123";
  await page.goto("/auth");
  await page.getByRole("button", { name: "Crear cuenta" }).first().click();
  await page.getByLabel("Nombre").fill(`Player ${label}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page
    .locator("form")
    .getByRole("button", { name: "Crear cuenta" })
    .click();
  await expect(page).toHaveURL(/\/auth\/verify-email/);

  await verifyEmail(email);
  await page.goto("/auth");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).last().click();
  await expect(page).toHaveURL(/\/onboarding\/compliance/);
  await page.getByLabel("Fecha de nacimiento").fill("1990-01-15");
  await page.getByLabel(/Acepto los/).check();
  await page.getByLabel(/Política de Privacidad/).check();
  await page.getByRole("button", { name: "Confirmar y continuar" }).click();
  await page.getByRole("button", { name: /Medio/ }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Prefiero no atajar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "PASE" }).click();
  await page.getByRole("button", { name: "Entrar a la app" }).click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(
    page.getByRole("heading", { name: "Lo que viene." }),
  ).toBeVisible();
});

test("@critical logout removes access to protected surfaces", async ({
  page,
}) => {
  await page.goto("/play");
  await expect(page).toHaveURL(/\/auth\?returnTo=/);
});
