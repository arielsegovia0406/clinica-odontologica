import { test, expect } from "@playwright/test";

test("login smoke — odontologo reaches clinic select", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo").fill("odontologo@demo.local");
  await page.getByLabel("Contraseña").fill("Demo1234!");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: /Seleccione clínica/i })).toBeVisible({
    timeout: 15_000,
  });
});
