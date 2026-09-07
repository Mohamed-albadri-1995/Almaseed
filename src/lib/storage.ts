import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { uploadsDir } from './uploads';

// Cloud storage is used only when all S3/R2 env vars are present; otherwise
// files are written to the local uploads directory (the Railway volume).
const S3 = {
  endpoint: process.env.STORAGE_ENDPOINT,
  region: process.env.STORAGE_REGION || 'auto',
  bucket: process.env.STORAGE_BUCKET,
  accessKeyId: process.env.STORAGE_ACCESS_KEY,
  secretAccessKey: process.env.STORAGE_SECRET_KEY,
  publicUrl: process.env.STORAGE_PUBLIC_URL, // base URL files are served from
};

export function storageConfigured(): boolean {
  return Boolean(
    S3.endpoint && S3.bucket && S3.accessKeyId && S3.secretAccessKey && S3.publicUrl,
  );
}

// Saves a file and returns the public URL to reference it by.
export async function saveUpload(
  name: string,
  bytes: Buffer,
  contentType: string,
): Promise<string> {
  if (storageConfigured()) {
    // Lazy-import so the SDK isn't loaded when running on local storage.
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = new S3Client({
      region: S3.region,
      endpoint: S3.endpoint,
      credentials: {
        accessKeyId: S3.accessKeyId!,
        secretAccessKey: S3.secretAccessKey!,
      },
    });
    await client.send(
      new PutObjectCommand({
        Bucket: S3.bucket!,
        Key: name,
        Body: bytes,
        ContentType: contentType,
      }),
    );
    // publicUrl base + key
    return `${S3.publicUrl!.replace(/\/$/, '')}/${name}`;
  }

  // Local fallback (Railway volume).
  const dir = uploadsDir();
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), bytes);
  return `/uploads/${name}`;
}
