import { expect, test } from "@playwright/test";
import { adminSql } from "./db";
import { staffSignIn } from "./helpers";

test.describe.configure({ mode: "serial" });

test("a solicitor records a gift and confirms a point; both are saved and audited", async ({ page }) => {
  await staffSignIn(page);
  await page.goto("/practice/estate?id=ellis&tab=iht");
  await expect(page.getByText("Excepted estate").first()).toBeVisible();

  await page.getByRole("button", { name: "Add gift" }).click();
  const sheet = page.getByRole("dialog", { name: "Add a lifetime gift" });
  await sheet.getByLabel("What was given").fill("Cash towards a car");
  await sheet.getByLabel("Date given").fill("2023-06-01");
  await sheet.getByLabel("Value when given").fill("20,000");
  await sheet.getByRole("button", { name: "Add gift", exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText("Cash towards a car", { exact: true })).toBeVisible();

  const confirm = page.getByRole("button", { name: /I've checked this/ }).first();
  await confirm.click();
  await expect(page.getByText("Confirmed").first()).toBeVisible();

  const sql = adminSql();
  try {
    await expect
      .poll(async () => (await sql`select count(*)::int as n from lifetime_gift g join estate e on e.id = g.estate_id where e.slug = 'ellis' and g.description = 'Cash towards a car'`)[0].n)
      .toBe(1);
    await expect
      .poll(async () => {
        const rows = await sql`select e.summary from audit_event e join estate s on s.id = e.estate_id where s.slug = 'ellis' order by e.seq desc limit 3`;
        return rows.map((r) => String(r.summary)).join(" | ");
      })
      .toMatch(/confirmed/i);
  } finally {
    await sql.end();
  }
});
