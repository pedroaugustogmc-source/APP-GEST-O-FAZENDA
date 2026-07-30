import { test, expect } from "@playwright/test";

const EMAIL = process.env.E2E_ADMIN_EMAIL;
const SENHA = process.env.E2E_ADMIN_SENHA;

test.skip(!EMAIL || !SENHA, "Defina E2E_ADMIN_EMAIL e E2E_ADMIN_SENHA para rodar os E2E.");

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(EMAIL!);
  await page.getByLabel("Senha").fill(SENHA!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("/");
});

test("cadastra um pasto novo e ele aparece na lista", async ({ page }) => {
  const nome = `Pasto Teste ${Date.now()}`;

  await page.goto("/pastos");
  await page.getByLabel("Nome").fill(nome);
  await page.getByLabel("Tamanho (ha)").fill("12,5");
  await page.getByRole("button", { name: "Guardar" }).click();

  await expect(page.getByText(nome)).toBeVisible({ timeout: 10_000 });
});
