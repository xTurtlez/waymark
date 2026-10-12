import { desc } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb, schema } from "@/db/client";
import { devToolsEnabled } from "@/server/env";

export const metadata: Metadata = { title: "Dev outbox", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Emails captured by the outbox driver. Not available in production unless WAYMARK_DEV_TOOLS=1 (CI). */
export default async function Outbox() {
  if (!devToolsEnabled()) notFound();
  const rows = await getDb().select().from(schema.outboundMessage).orderBy(desc(schema.outboundMessage.createdAt)).limit(50);
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-serif text-3xl font-normal">Dev outbox</h1>
      <p className="text-sm text-muted">Emails sent with MAIL_DRIVER=outbox. Newest first.</p>
      <ul className="m-0 mt-6 flex list-none flex-col gap-4 p-0">
        {rows.map((m) => (
          <li key={m.id} className="rounded-[18px] border border-line bg-paper p-5" data-testid="outbox-message" data-to={m.toAddress}>
            <div className="text-xs text-muted">
              {m.createdAt.toISOString()} · to <b>{m.toAddress}</b>
            </div>
            <div className="mt-1 font-semibold">{m.subject}</div>
            <pre className="mt-3 whitespace-pre-wrap break-all font-sans text-sm text-ink-2">{m.textBody}</pre>
          </li>
        ))}
      </ul>
    </main>
  );
}
