import { getDb, schema } from "@/db/client";
import { env } from "./env";

/**
 * Outbound email. One interface, two drivers:
 * - outbox: stored in `outbound_message` only (dev/CI; read at /dev/outbox)
 * - postmark: sent via Postmark's API (use the EU/UK-hosted account) and also recorded
 * Later channels (SMS, hybrid post) sit behind the same shape.
 */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  firmId?: string | null;
}

export async function sendMail(msg: MailMessage): Promise<void> {
  const e = env();
  const db = getDb();
  const [row] = await db
    .insert(schema.outboundMessage)
    .values({
      firmId: msg.firmId ?? null,
      channel: "email",
      toAddress: msg.to.toLowerCase(),
      subject: msg.subject,
      textBody: msg.text,
      htmlBody: msg.html,
      provider: e.MAIL_DRIVER,
      status: e.MAIL_DRIVER === "outbox" ? "sent" : "queued",
      sentAt: e.MAIL_DRIVER === "outbox" ? new Date() : null,
    })
    .returning({ id: schema.outboundMessage.id });

  if (e.MAIL_DRIVER !== "postmark") return;
  if (!e.POSTMARK_SERVER_TOKEN) throw new Error("POSTMARK_SERVER_TOKEN is not set");
  const { eq } = await import("drizzle-orm");
  try {
    const res = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", "X-Postmark-Server-Token": e.POSTMARK_SERVER_TOKEN },
      body: JSON.stringify({ From: e.MAIL_FROM, To: msg.to, Subject: msg.subject, TextBody: msg.text, HtmlBody: msg.html, MessageStream: "outbound" }),
    });
    const json = (await res.json()) as { MessageID?: string; Message?: string };
    if (!res.ok) throw new Error(json.Message ?? `Postmark error ${res.status}`);
    await db.update(schema.outboundMessage).set({ status: "sent", sentAt: new Date(), providerMessageId: json.MessageID }).where(eq(schema.outboundMessage.id, row.id));
  } catch (err) {
    await db.update(schema.outboundMessage).set({ status: "failed", error: String(err) }).where(eq(schema.outboundMessage.id, row.id));
    throw err;
  }
}

/** Plain, warm email shell. Kept simple so it renders in every client. */
export function emailHtml(heading: string, paragraphs: string[], action?: { label: string; url: string }): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!doctype html><html><body style="margin:0;background:#FBF6EE;font-family:Arial,Helvetica,sans-serif;color:#2B211C">
<div style="max-width:520px;margin:0 auto;padding:32px 24px">
<p style="font-size:14px;color:#5E524A;margin:0 0 24px">Waymark</p>
<h1 style="font-family:Georgia,serif;font-weight:400;font-size:26px;line-height:1.2;margin:0 0 16px">${esc(heading)}</h1>
${paragraphs.map((p) => `<p style="font-size:16px;line-height:1.55;margin:0 0 14px">${esc(p)}</p>`).join("")}
${action ? `<p style="margin:24px 0"><a href="${esc(action.url)}" style="display:inline-block;background:#0E5F5B;color:#FFFDF9;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:14px">${esc(action.label)}</a></p>` : ""}
<p style="font-size:13px;color:#7A6D63;margin:24px 0 0">If you didn't expect this email, you can ignore it. Waymark is software used by your solicitor; it is not a law firm and does not give legal advice.</p>
</div></body></html>`;
}
