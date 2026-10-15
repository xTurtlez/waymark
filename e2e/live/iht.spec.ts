import { expect, test } from "@playwright/test";
import { staffSignIn } from "./helpers";

// The IHT workspace: read-only checks, run at desktop and phone width.

test("the IHT tab explains the calculation for an estate that pays tax", async ({ page }) => {
  await staffSignIn(page);
  await page.goto("/practice/estate?id=mehta&tab=iht");
  await expect(page.getByRole("heading", { name: "Estate of Anil Mehta" })).toBeVisible();
  await expect(page.getByText("£305,200").first()).toBeVisible();
  await expect(page.getByText("Full account (IHT400)")).toBeVisible();
  const calc = page.getByRole("region", { name: "Tax" });
  await expect(calc).toBeVisible();
  // Every figure can be traced to its source.
  await expect(page.getByRole("link", { name: /GOV\.UK|HMRC|legislation/i }).first()).toBeVisible();
  // The breakdown downloads as a CSV for the file.
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV" }).click();
  expect((await download).suggestedFilename()).toBe("HRT-0389-iht.csv");
});

test("an intestate estate shows who inherits", async ({ page }) => {
  await staffSignIn(page);
  await page.goto("/practice/estate?id=reid&tab=iht");
  await expect(page.getByRole("heading", { name: "No will: intestacy" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No will: intestacy" }).locator("xpath=ancestor::section[1]").getByText("£410,500", { exact: true })).toBeVisible();
});
