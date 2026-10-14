import { expect, test } from "@playwright/test";
import { adminSql } from "./db";
import { familySignIn, staffSignIn } from "./helpers";

test.describe.configure({ mode: "serial" });

test("solicitor approves an AI draft; it is audited and the family is updated", async ({ page, browser }) => {
  await staffSignIn(page);
  await page.getByRole("link", { name: /Margaret Ellis/ }).first().click();
  await expect(page.getByRole("heading", { name: "Estate of Margaret Ann Ellis" })).toBeVisible();
  await page.getByRole("button", { name: /Approve & send/ }).first().click();
  await expect(page.getByText("Chaser to Barclays sent.")).toBeVisible();

  // The audit trail in the database records it, and the hash chain still verifies.
  const sql = adminSql();
  try {
    // The screen updates optimistically; wait for the server write to land.
    await expect
      .poll(async () => {
        const rows = await sql`select e.summary from audit_event e join estate s on s.id = e.estate_id where s.slug = 'ellis' and e.actor_type = 'staff' order by e.seq desc limit 5`;
        return rows.map((r) => String(r.summary)).join(" | ");
      })
      .toMatch(/approved/i);
    const [chain] = await sql`select count(*) filter (where audit_verify(id) is not null)::int as broken from firm`;
    expect(chain.broken).toBe(0);
  } finally {
    await sql.end();
  }

  // Sarah sees a plain-English update in her portal.
  const ctx = await browser.newContext();
  const family = await ctx.newPage();
  await familySignIn(family);
  await family.goto("/portal/updates");
  await expect(family.getByText("We've written to Barclays on your behalf")).toBeVisible();
  await ctx.close();
});

test("an executor uploads a document and the firm is asked to check it", async ({ page, browser }) => {
  await familySignIn(page);
  await page.goto("/portal/documents");
  const png = Buffer.from("89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D4944415478DA63F8CFC0F01F0005000201C2D4D1E70000000049454E44AE426082", "hex");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Add Funeral invoice" }).click();
  await (await chooser).setFiles({ name: "funeral-invoice.png", mimeType: "image/png", buffer: png });
  await expect(page.getByRole("status")).toContainText("funeral invoice");

  const sql = adminSql();
  try {
    await expect.poll(async () => (await sql`select count(*)::int as n from file_object where file_name = 'funeral-invoice.png'`)[0].n).toBe(1);
    const [file] = await sql`select sha256, scan_status from file_object where file_name = 'funeral-invoice.png'`;
    expect(String(file.sha256)).toMatch(/^[0-9a-f]{64}$/);
    expect(file.scan_status).toBe("clean");
  } finally {
    await sql.end();
  }

  const ctx = await browser.newContext();
  const staff = await ctx.newPage();
  await staffSignIn(staff);
  await staff.goto("/practice/estate?id=ellis");
  await expect(staff.getByText("Check Funeral invoice from Sarah")).toBeVisible();
  await ctx.close();
});
