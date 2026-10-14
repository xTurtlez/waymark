import { expect, test } from "@playwright/test";

// The public GitHub Pages demo: static export, seeded data, browser-only store.

test("demo home links to both sides", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: /Every estate, every blocker/ })).toBeVisible();
  await page.getByRole("link", { name: /Practice workspace/ }).click();
  await expect(page.getByRole("heading", { name: /estates? need you today|Nothing urgent/ })).toBeVisible();
});

test("approving a draft in the practice shows up in the portal", async ({ page }) => {
  await page.goto("practice/estate/?id=ellis");
  await expect(page.getByRole("heading", { name: "Estate of Margaret Ann Ellis" })).toBeVisible();
  await page.getByRole("button", { name: /Approve & send/ }).first().click();
  await expect(page.getByText("Chaser to Barclays sent.")).toBeVisible();
  await page.goto("portal/updates/");
  await expect(page.getByText("We've written to Barclays on your behalf")).toBeVisible();
});

test("portal journey renders with the seven stages", async ({ page }) => {
  await page.goto("portal/");
  await expect(page.getByRole("heading", { name: /You're doing well/ })).toBeVisible();
  await expect(page.getByRole("list", { name: /Your path/ }).getByRole("listitem")).toHaveCount(7);
});
