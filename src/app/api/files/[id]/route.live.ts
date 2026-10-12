import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { schema, withTenant } from "@/db/client";
import { getStorage } from "@/server/files/storage";
import { getViewer, tenantOf } from "@/server/viewer";

/** Download a stored file. Access is decided by row-level security. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Not found", { status: 404 });
  const viewer = await getViewer();
  if (!viewer || viewer.kind === "none") return new NextResponse("Unauthorised", { status: 401 });
  const row = await withTenant(tenantOf(viewer), async (tx) => {
    const [r] = await tx.select().from(schema.fileObject).where(eq(schema.fileObject.id, id)).limit(1);
    return r;
  });
  if (!row || row.scanStatus === "infected") return new NextResponse("Not found", { status: 404 });
  const storage = getStorage();
  const url = await storage.signedUrl(row.storageKey, row.fileName);
  if (url) return NextResponse.redirect(url);
  const bytes = await storage.read(row.storageKey);
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": row.mimeType,
      "Content-Disposition": `inline; filename="${row.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
