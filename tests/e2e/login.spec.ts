import { test, expect } from "@playwright/test";

const EMAIL = process.env.E2E_ADMIN_EMAIL;
const SENHA = process.env.E2E_ADMIN_SENHA;

test.skip(
  !EMAIL || !SENHA,
  "Defina E2E_ADMIN_EMAIL e E2E_ADMIN_SENHA (um admin real já cadastrado em usuarios_acesso) para rodar os E2E."
);

test("admin entra e vê a tela inicial", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(EMAIL!);
  await page.getByLabel("Senha").fill(SENHA!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("O que você quer cadastrar hoje?")).toBeVisible();
});

test("sem sessão, /pastos redireciona para /login", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/pastos");
  await expect(page).toHaveURL(/\/login/);
});
