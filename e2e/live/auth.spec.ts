import { expect, test } from "@playwright/test";
import { OWEN, familySignIn, staffSignIn } from "./helpers";

test("signed-out visitors are sent to sign in", async ({ page }) => {
  await page.goto("/practice");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fpractice/);
  await page.goto("/portal");
  await expect(page).toHaveURL(/\/sign-in\?as=family/);
});

test("a wrong password is refused", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Work email").fill("priya.shah@ellis-rowe.example");
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in/);
});

test("staff only ever see their own firm's estates", async ({ page }) => {
  await staffSignIn(page, OWEN);
  await page.goto("/practice/estates");
  await expect(page.getByText("Margaret Ellis")).toHaveCount(0);
  await page.goto("/practice/estate?id=ellis");
  await expect(page.getByText("That estate could not be found.")).toBeVisible();
});

test("a family member is kept out of the practice workspace", async ({ page }) => {
  await familySignIn(page);
  await page.goto("/practice");
  await expect(page).toHaveURL(/\/portal/);
});

// Needs a server started with a low limit: E2E_SIGNIN_LIMIT=3 npx playwright test -g "rate limited" (CI does this).
test("repeated sign-in attempts are rate limited with a clear message", async ({ page }) => {
  const limit = Number(process.env.E2E_SIGNIN_LIMIT ?? 200);
  test.skip(limit > 10, "Only meaningful with a low E2E_SIGNIN_LIMIT");
  await page.goto("/sign-in");
  for (let i = 0; i <= limit; i++) {
    await page.getByLabel("Work email").fill("nobody@example.com");
    await page.getByLabel("Password").fill("wrong-password-123");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toBeVisible();
  }
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText("Too many attempts");
});
