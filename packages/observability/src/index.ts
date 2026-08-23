export interface LoggerConfig {
  level: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
  service: string;
}

export interface StructuredLoggerOptions {
  level: LoggerConfig["level"];
  base: { service: string };
}

export function createLoggerOptions(
  config: LoggerConfig,
): StructuredLoggerOptions {
  return { level: config.level, base: { service: config.service } };
}
