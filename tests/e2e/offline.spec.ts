import { test, expect } from "@playwright/test";

const EMAIL = process.env.E2E_ADMIN_EMAIL;
const SENHA = process.env.E2E_ADMIN_SENHA;

test.skip(!EMAIL || !SENHA, "Defina E2E_ADMIN_EMAIL e E2E_ADMIN_SENHA para rodar os E2E.");

// docs/05-arquitetura.md §36 item 7: modo avião → 3 registros → volta
// online → 3 registros no banco, zero duplicata.
test("3 cadastros offline sincronizam sem duplicar ao voltar", async ({ page, context }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(EMAIL!);
  await page.getByLabel("Senha").fill(SENHA!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("/");

  await page.goto("/pastos");

  await context.setOffline(true);

  const prefixo = `Offline ${Date.now()}`;
  const nomes = [`${prefixo} A`, `${prefixo} B`, `${prefixo} C`];

  for (const nome of nomes) {
    await page.getByLabel("Nome").fill(nome);
    await page.getByLabel("Tamanho (ha)").fill("5");
    await page.getByRole("button", { name: "Guardar" }).click();
  }

  await expect(page.getByText(/registros aguardando sincronizar/)).toBeVisible();

  await context.setOffline(false);

  await expect(page.getByText(/registros? aguardando sincronizar/)).toBeHidden({ timeout: 20_000 });

  await page.reload();
  for (const nome of nomes) {
    await expect(page.getByText(nome, { exact: true })).toHaveCount(1);
  }
});
