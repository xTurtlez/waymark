import { NextResponse } from "next/server";
import { storeUpload, UploadError } from "@/server/files/upload";
import { getViewer } from "@/server/viewer";

export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer || viewer.kind === "none") return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const estate = form?.get("estate");
  const documentKey = form?.get("documentKey");
  if (!(file instanceof File) || typeof estate !== "string") return NextResponse.json({ error: "No file received." }, { status: 400 });
  try {
    const out = await storeUpload(viewer, file, {
      estateSlug: estate,
      documentKey: typeof documentKey === "string" && /^[\w-]{1,80}$/.test(documentKey) ? documentKey : undefined,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: req.headers.get("user-agent"),
    });
    return NextResponse.json(out, { status: 201 });
  } catch (err) {
    if (err instanceof UploadError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("upload failed", err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
