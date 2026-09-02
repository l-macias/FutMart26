export interface LoggerConfig {
  level: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
  service: string;
}

export interface StructuredLoggerOptions {
  level: LoggerConfig["level"];
  base: { service: string };
  redact: {
    paths: string[];
    censor: string;
  };
}

export function createLoggerOptions(
  config: LoggerConfig,
): StructuredLoggerOptions {
  return {
    level: config.level,
    base: { service: config.service },
    redact: {
      censor: "[REDACTED]",
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "res.headers.set-cookie",
        "headers.authorization",
        "headers.cookie",
        "headers.set-cookie",
        "body.password",
        "body.currentPassword",
        "body.newPassword",
        "body.confirmPassword",
        "body.token",
        "query.token",
        "password",
        "token",
      ],
    },
  };
}
