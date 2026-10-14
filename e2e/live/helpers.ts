import { expect, type Page } from "@playwright/test";

export const PRIYA = "priya.shah@ellis-rowe.example";
export const SARAH = "sarah.ellis@example.com";
export const OWEN = "owen.price@hartley-moss.example";
export const PASSWORD = process.env.SEED_STAFF_PASSWORD || "waymark-demo-password";

export async function staffSignIn(page: Page, email = PRIYA) {
  await page.goto("/sign-in");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/practice/);
}

async function outboxLinks(page: Page, email: string): Promise<string[]> {
  await page.goto("/dev/outbox");
  const texts = await page.locator(`[data-testid=outbox-message][data-to="${email}"] pre`).allTextContents();
  return texts.map((t) => t.match(/https?:\/\/\S+/)?.[0]).filter((x): x is string => Boolean(x));
}

/** Request a magic link, read the new one from the dev outbox, and follow it. */
export async function familySignIn(page: Page, email = SARAH) {
  const seen = new Set(await outboxLinks(page, email));
  await page.goto("/sign-in?as=family");
  await page.getByRole("tab", { name: "Executor or family" }).click();
  await page.getByLabel("Your email address").fill(email);
  await page.getByRole("button", { name: "Email me a link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        link = (await outboxLinks(page, email)).find((l) => !seen.has(l));
        return link;
      },
      { timeout: 15_000 },
    )
    .toBeTruthy();
  await page.goto(link!);
  await expect(page).toHaveURL(/\/portal/);
}
