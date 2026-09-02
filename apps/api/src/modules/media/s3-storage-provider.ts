import { Readable } from "node:stream";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import type { StorageProvider, StoredObject } from "./storage-provider.js";

export class S3CompatibleStorageProvider implements StorageProvider {
  readonly available = true;
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    input: {
      endpoint: string;
      region: string;
      accessKey: string;
      secretKey: string;
      forcePathStyle: boolean;
    },
  ) {
    this.client = new S3Client({
      endpoint: input.endpoint,
      region: input.region,
      forcePathStyle: input.forcePathStyle,
      credentials: {
        accessKeyId: input.accessKey,
        secretAccessKey: input.secretKey,
      },
    });
  }

  async checkReadiness() {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }), {
      abortSignal: AbortSignal.timeout(3_000),
    });
  }

  async putObject(input: { key: string; body: Buffer; contentType: string }) {
    const result = await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        CacheControl: "private, max-age=31536000, immutable",
      }),
    );
    return { etag: result.ETag ?? null };
  }

  async getObject(key: string): Promise<StoredObject | null> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!(result.Body instanceof Readable))
        throw new Error("S3-compatible provider returned a non-Node stream");
      return {
        body: result.Body,
        contentType: result.ContentType ?? "application/octet-stream",
        contentLength: result.ContentLength ?? 0,
        etag: result.ETag ?? null,
      };
    } catch (error) {
      if (isMissingObject(error)) return null;
      throw error;
    }
  }

  async deleteObject(key: string) {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}

function isMissingObject(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    ["NoSuchKey", "NotFound"].includes(String(error.name))
  );
}
