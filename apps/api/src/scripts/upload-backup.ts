import { createReadStream } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { z } from "zod";

const booleanString = z
  .enum(["true", "false"])
  .transform((value) => value === "true");
const optionalNonEmpty = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);
const optionalHttpsUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.url().startsWith("https://").optional(),
);
const environment = z
  .object({
    BACKUP_FILE: z.string().min(1),
    BACKUP_S3_ENDPOINT: optionalHttpsUrl,
    BACKUP_S3_REGION: z.string().min(1).default("us-east-1"),
    BACKUP_S3_BUCKET: z.string().min(1),
    BACKUP_S3_PREFIX: z.string().trim().default("database"),
    BACKUP_S3_ACCESS_KEY: optionalNonEmpty,
    BACKUP_S3_SECRET_KEY: optionalNonEmpty,
    BACKUP_S3_FORCE_PATH_STYLE: booleanString.default(false),
  })
  .superRefine((value, context) => {
    const credentials = [
      value.BACKUP_S3_ACCESS_KEY,
      value.BACKUP_S3_SECRET_KEY,
    ];
    if (credentials.some(Boolean) && !credentials.every(Boolean))
      context.addIssue({
        code: "custom",
        path: ["BACKUP_S3_ACCESS_KEY"],
        message:
          "BACKUP_S3_ACCESS_KEY and BACKUP_S3_SECRET_KEY must be provided together",
      });
  })
  .parse(process.env);

const repository = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);
const source = path.resolve(environment.BACKUP_FILE);
if (source === repository || source.startsWith(`${repository}${path.sep}`))
  throw new Error("BACKUP_FILE must be outside the repository");
const checksumFile = `${source}.sha256`;
await Promise.all([access(source), access(checksumFile)]);
const metadata = await stat(source);
if (metadata.size === 0) throw new Error("Backup file is empty");
const checksum = z
  .string()
  .regex(/^[0-9a-f]{64}$/i, "Backup checksum file is invalid")
  .parse((await readFile(checksumFile, "utf8")).trim().split(/\s+/, 1)[0]);

const credentials =
  environment.BACKUP_S3_ACCESS_KEY && environment.BACKUP_S3_SECRET_KEY
    ? {
        accessKeyId: environment.BACKUP_S3_ACCESS_KEY,
        secretAccessKey: environment.BACKUP_S3_SECRET_KEY,
      }
    : undefined;
const client = new S3Client({
  endpoint: environment.BACKUP_S3_ENDPOINT,
  region: environment.BACKUP_S3_REGION,
  forcePathStyle: environment.BACKUP_S3_FORCE_PATH_STYLE,
  credentials,
});
const prefix = environment.BACKUP_S3_PREFIX.replace(/^\/+|\/+$/g, "");
const key = [prefix, path.basename(source)].filter(Boolean).join("/");

await client.send(
  new PutObjectCommand({
    Bucket: environment.BACKUP_S3_BUCKET,
    Key: key,
    Body: createReadStream(source),
    ContentType: "application/octet-stream",
    ServerSideEncryption: "AES256",
    Metadata: { sha256: checksum },
  }),
  { abortSignal: AbortSignal.timeout(30 * 60_000) },
);
const uploaded = await client.send(
  new HeadObjectCommand({ Bucket: environment.BACKUP_S3_BUCKET, Key: key }),
  { abortSignal: AbortSignal.timeout(10_000) },
);
if (uploaded.ContentLength !== metadata.size)
  throw new Error("Off-host backup size verification failed");
if (uploaded.Metadata?.sha256 !== checksum)
  throw new Error("Off-host backup checksum metadata verification failed");

process.stdout.write(
  `Off-host backup verified: s3://${environment.BACKUP_S3_BUCKET}/${key} (${metadata.size} bytes)\n`,
);
