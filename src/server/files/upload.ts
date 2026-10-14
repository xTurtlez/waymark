import "server-only";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { schema, withTenant } from "@/db/client";
import { writeAudit } from "../audit";
import { env } from "../env";
import { tenantOf, type FamilyViewer, type StaffViewer } from "../viewer";
import { getScanner } from "./scan";
import { cleanFileName, EXTENSION, sniffMime } from "./sniff";
import { getStorage } from "./storage";

export class UploadError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/** Validate, scan, hash and store an upload, then record it (RLS-scoped) and audit it. */
export async function storeUpload(
  viewer: StaffViewer | FamilyViewer,
  file: File,
  meta: { estateSlug: string; documentKey?: string; ip?: string | null; userAgent?: string | null },
) {
  const maxBytes = env().MAX_UPLOAD_MB * 1024 * 1024;
  if (file.size === 0) throw new UploadError("That file is empty.");
  if (file.size > maxBytes) throw new UploadError(`Files can be up to ${env().MAX_UPLOAD_MB} MB.`, 413);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffMime(bytes);
  if (!mime) throw new UploadError("Please upload a photo (JPEG, PNG, HEIC, WebP) or a PDF.", 415);

  const scanner = getScanner(env().MALWARE_SCANNER);
  const scan = await scanner.scan(bytes);
  if (scan === "infected") throw new UploadError("This file can't be accepted. Please try a different copy.", 422);

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const fileName = cleanFileName(file.name);

  return withTenant(tenantOf(viewer), async (tx) => {
    const [est] = await tx.select({ id: schema.estate.id }).from(schema.estate).where(eq(schema.estate.slug, meta.estateSlug)).limit(1);
    if (!est) throw new UploadError("That estate could not be found.", 404);
    const key = `firm/${viewer.firmId}/estate/${est.id}/${crypto.randomUUID()}.${EXTENSION[mime]}`;
    await getStorage().put(key, bytes, mime);
    const [row] = await tx
      .insert(schema.fileObject)
      .values({
        firmId: viewer.firmId,
        estateId: est.id,
        uploadedBy: viewer.userId,
        storageKey: key,
        fileName,
        mimeType: mime,
        sizeBytes: bytes.byteLength,
        sha256,
        scanStatus: scan === "clean" ? "clean" : "unscanned",
        documentKey: meta.documentKey ?? null,
      })
      .returning({ id: schema.fileObject.id });
    await writeAudit(tx, {
      firmId: viewer.firmId,
      estateId: est.id,
      actorType: viewer.kind === "staff" ? "staff" : "family",
      actorUserId: viewer.userId,
      action: "file.upload",
      entityType: "file",
      entityId: row.id,
      summary: `${viewer.name} uploaded ${fileName}`,
      after: { fileName, mime, size: bytes.byteLength, sha256, scan: scan, scanner: scanner.name },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return { id: row.id, fileName, sha256 };
  });
}
