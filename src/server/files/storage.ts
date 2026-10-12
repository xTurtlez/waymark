import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../env";

/**
 * Object storage behind one interface.
 * - s3: any S3-compatible store in London (AWS eu-west-2), server-side encryption, signed URLs.
 * - local: files on disk, for development only.
 */
export interface Storage {
  put(key: string, bytes: Uint8Array, mime: string): Promise<void>;
  /** A short-lived URL to download the object, or null if the caller should stream it. */
  signedUrl(key: string, fileName: string): Promise<string | null>;
  read(key: string): Promise<Uint8Array>;
}

function s3(): Storage {
  const e = env();
  if (!e.S3_BUCKET) throw new Error("S3_BUCKET is not set");
  const client = new S3Client({
    region: e.S3_REGION,
    endpoint: e.S3_ENDPOINT || undefined,
    forcePathStyle: Boolean(e.S3_ENDPOINT),
    credentials: e.S3_ACCESS_KEY_ID && e.S3_SECRET_ACCESS_KEY ? { accessKeyId: e.S3_ACCESS_KEY_ID, secretAccessKey: e.S3_SECRET_ACCESS_KEY } : undefined,
  });
  const Bucket = e.S3_BUCKET;
  return {
    async put(key, bytes, mime) {
      await client.send(new PutObjectCommand({ Bucket, Key: key, Body: bytes, ContentType: mime, ServerSideEncryption: "AES256" }));
    },
    async signedUrl(key, fileName) {
      return getSignedUrl(client, new GetObjectCommand({ Bucket, Key: key, ResponseContentDisposition: `inline; filename="${fileName.replace(/"/g, "")}"` }), { expiresIn: 300 });
    },
    async read(key) {
      const res = await client.send(new GetObjectCommand({ Bucket, Key: key }));
      return new Uint8Array(await res.Body!.transformToByteArray());
    },
  };
}

function local(): Storage {
  const root = path.resolve(env().STORAGE_LOCAL_DIR);
  const file = (key: string) => {
    const p = path.resolve(root, key);
    if (!p.startsWith(root + path.sep)) throw new Error("Invalid storage key");
    return p;
  };
  return {
    async put(key, bytes) {
      await mkdir(path.dirname(file(key)), { recursive: true });
      await writeFile(file(key), bytes);
    },
    async signedUrl() {
      return null;
    },
    async read(key) {
      return new Uint8Array(await readFile(file(key)));
    },
  };
}

let cached: Storage | undefined;
export function getStorage(): Storage {
  if (!cached) cached = env().STORAGE_DRIVER === "s3" ? s3() : local();
  return cached;
}
