import { z } from "zod";

const environmentBoolean = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  if (["true", "1"].includes(value.toLowerCase())) return true;
  if (["false", "0"].includes(value.toLowerCase())) return false;
  return value;
}, z.boolean());

const optionalNonEmpty = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const trustProxy = z.preprocess((value) => {
  if (value === undefined || value === "") return false;
  if (typeof value !== "string") return value;
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  return value;
}, z.boolean());

const environmentSchema = z
  .object({
    DATABASE_URL: z.url(),
    WEB_URL: z.url(),
    ADMIN_URL: z.url(),
    API_HOST: z.string().min(1).default("0.0.0.0"),
    API_PORT: z.coerce.number().int().positive().max(65_535).default(4000),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    AUTH_REQUIRE_EMAIL_VERIFICATION: environmentBoolean.optional(),
    SUPPORT_EMAIL: z.email(),
    TRUST_PROXY: trustProxy.default(false),
    DB_POOL_MAX: z.coerce.number().int().positive().max(50).default(10),
    DB_IDLE_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(300_000)
      .default(20_000),
    DB_CONNECTION_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(60_000)
      .default(10_000),
    SHUTDOWN_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(60_000)
      .default(15_000),
    SMTP_HOST: optionalNonEmpty,
    SMTP_PORT: z.coerce.number().int().positive().max(65_535).default(587),
    SMTP_SECURE: environmentBoolean.default(false),
    SMTP_USER: optionalNonEmpty,
    SMTP_PASSWORD: optionalNonEmpty,
    MAIL_FROM: optionalNonEmpty,
    OBJECT_STORAGE_ENABLED: environmentBoolean.default(false),
    OBJECT_STORAGE_ENDPOINT: z.url().optional(),
    OBJECT_STORAGE_REGION: z.string().min(1).default("us-east-1"),
    OBJECT_STORAGE_BUCKET: z.string().min(1).optional(),
    OBJECT_STORAGE_ACCESS_KEY: z.string().min(1).optional(),
    OBJECT_STORAGE_SECRET_KEY: z.string().min(1).optional(),
    OBJECT_STORAGE_FORCE_PATH_STYLE: environmentBoolean.default(true),
    OBJECT_STORAGE_READINESS_CHECK: environmentBoolean.default(true),
    APP_VERSION: optionalNonEmpty,
    GIT_SHA: optionalNonEmpty,
  })
  .superRefine((value, context) => {
    if (value.OBJECT_STORAGE_ENABLED) {
      for (const key of [
        "OBJECT_STORAGE_ENDPOINT",
        "OBJECT_STORAGE_BUCKET",
        "OBJECT_STORAGE_ACCESS_KEY",
        "OBJECT_STORAGE_SECRET_KEY",
      ] as const) {
        if (!value[key])
          context.addIssue({
            code: "custom",
            path: [key],
            message: `${key} is required when object storage is enabled`,
          });
      }
    }
    const smtpValues = [value.SMTP_USER, value.SMTP_PASSWORD];
    if (smtpValues.some(Boolean) && !smtpValues.every(Boolean)) {
      context.addIssue({
        code: "custom",
        path: ["SMTP_USER"],
        message: "SMTP_USER and SMTP_PASSWORD must be provided together",
      });
    }
    if (value.NODE_ENV === "production") {
      if (value.AUTH_REQUIRE_EMAIL_VERIFICATION === false)
        context.addIssue({
          code: "custom",
          path: ["AUTH_REQUIRE_EMAIL_VERIFICATION"],
          message: "Email verification cannot be disabled in production",
        });
      if (!value.BETTER_AUTH_URL.startsWith("https://")) {
        context.addIssue({
          code: "custom",
          path: ["BETTER_AUTH_URL"],
          message: "BETTER_AUTH_URL must use HTTPS in production",
        });
      }
      for (const [key, url] of [
        ["WEB_URL", value.WEB_URL],
        ["ADMIN_URL", value.ADMIN_URL],
      ] as const) {
        if (!url.startsWith("https://"))
          context.addIssue({
            code: "custom",
            path: [key],
            message: `${key} must use HTTPS in production`,
          });
      }
      for (const key of ["SMTP_HOST", "MAIL_FROM"] as const) {
        if (!value[key])
          context.addIssue({
            code: "custom",
            path: [key],
            message: `${key} is required in production`,
          });
      }
      if (!value.OBJECT_STORAGE_ENABLED)
        context.addIssue({
          code: "custom",
          path: ["OBJECT_STORAGE_ENABLED"],
          message: "Object storage must be enabled in production",
        });
    }
  });

export type ApiConfig = z.infer<typeof environmentSchema>;

export function loadConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ApiConfig {
  return environmentSchema.parse(environment);
}
