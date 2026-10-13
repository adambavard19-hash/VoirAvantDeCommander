import "server-only";
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";
import type { StorageDriver } from "./types";

let client: S3Client | null = null;

function s3(): S3Client {
  if (client) return client;
  const e = env();
  if (!e.S3_BUCKET || !e.S3_ACCESS_KEY_ID || !e.S3_SECRET_ACCESS_KEY) {
    throw new Error("Stockage S3 non configuré (S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY).");
  }
  client = new S3Client({
    region: e.S3_REGION,
    endpoint: e.S3_ENDPOINT,
    forcePathStyle: e.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: e.S3_ACCESS_KEY_ID, secretAccessKey: e.S3_SECRET_ACCESS_KEY },
  });
  return client;
}

const bucket = () => env().S3_BUCKET!;

/** Les clés contiennent un identifiant unique par fichier : elles peuvent être mises en cache indéfiniment. */
const IMMUTABLE = "public, max-age=31536000, immutable";

export const s3Driver: StorageDriver = {
  name: "s3",
  async put(key, body, contentType) {
    await s3().send(
      new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType, CacheControl: IMMUTABLE }),
    );
  },
  async getBuffer(key) {
    try {
      const res = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
      if (!res.Body) return null;
      return Buffer.from(await res.Body.transformToByteArray());
    } catch {
      return null;
    }
  },
  async stat(key) {
    try {
      const res = await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
      return { size: res.ContentLength ?? 0 };
    } catch {
      return null;
    }
  },
  async delete(key) {
    await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
  },
  async deletePrefix(prefix) {
    let token: string | undefined;
    do {
      const list = await s3().send(
        new ListObjectsV2Command({ Bucket: bucket(), Prefix: prefix, ContinuationToken: token }),
      );
      const keys = (list.Contents ?? []).map((o) => ({ Key: o.Key! }));
      if (keys.length) await s3().send(new DeleteObjectsCommand({ Bucket: bucket(), Delete: { Objects: keys } }));
      token = list.IsTruncated ? list.NextContinuationToken : undefined;
    } while (token);
  },
  publicUrl(key) {
    const base = env().S3_PUBLIC_URL?.replace(/\/+$/, "");
    if (!base) throw new Error("S3_PUBLIC_URL doit être défini pour servir les fichiers.");
    return `${base}/${key}`;
  },
  async createUploadTarget(key, contentType) {
    const url = await getSignedUrl(
      s3(),
      new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType, CacheControl: IMMUTABLE }),
      { expiresIn: 3600 },
    );
    return { url, method: "PUT", headers: { "Content-Type": contentType, "Cache-Control": IMMUTABLE } };
  },
};
