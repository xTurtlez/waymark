/**
 * Identify a file by its first bytes rather than trusting the browser's
 * Content-Type or extension. Only document and photo formats are allowed.
 */
export type AllowedMime = "application/pdf" | "image/jpeg" | "image/png" | "image/webp" | "image/heic";

export function sniffMime(bytes: Uint8Array): AllowedMime | null {
  const b = bytes;
  const at = (i: number, ...vals: number[]) => vals.every((v, j) => b[i + j] === v);
  if (b.length >= 5 && at(0, 0x25, 0x50, 0x44, 0x46, 0x2d)) return "application/pdf"; // %PDF-
  if (b.length >= 3 && at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (b.length >= 8 && at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (b.length >= 12 && at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp"; // RIFF....WEBP
  if (b.length >= 12 && at(4, 0x66, 0x74, 0x79, 0x70)) {
    const brand = String.fromCharCode(...b.slice(8, 12));
    if (["heic", "heix", "mif1", "msf1", "hevc", "heim", "heis"].includes(brand)) return "image/heic";
  }
  return null;
}

export const EXTENSION: Record<AllowedMime, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

/** Keep a readable, safe file name for display (never used as a storage path). */
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "").trim().slice(0, 180);
  return cleaned || "file";
}
