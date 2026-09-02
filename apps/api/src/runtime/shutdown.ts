export interface ShutdownLogger {
  info(metadata: object, message: string): void;
  warn(metadata: object, message: string): void;
}

export function createShutdownController(input: {
  close: () => Promise<void>;
  timeoutMs: number;
  logger: ShutdownLogger;
  setExitCode?: (code: number) => void;
  forceExit?: (code: number) => void;
}) {
  let shutdown: Promise<void> | undefined;
  const setExitCode =
    input.setExitCode ?? ((code) => (process.exitCode = code));
  const forceExit = input.forceExit ?? ((code) => process.exit(code));

  const run = (signal: string) => {
    if (shutdown) return shutdown;
    shutdown = new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        input.logger.warn(
          { signal, timeoutMs: input.timeoutMs },
          "graceful shutdown timed out",
        );
        forceExit(1);
      }, input.timeoutMs);
      timeout.unref();
      input.logger.info({ signal }, "graceful shutdown started");
      void input
        .close()
        .then(() => {
          clearTimeout(timeout);
          input.logger.info({ signal }, "graceful shutdown completed");
          resolve();
        })
        .catch((error: unknown) => {
          clearTimeout(timeout);
          input.logger.warn({ signal, err: error }, "graceful shutdown failed");
          setExitCode(1);
          resolve();
        });
    });
    return shutdown;
  };

  return {
    run,
    register() {
      process.once("SIGTERM", () => void run("SIGTERM"));
      process.once("SIGINT", () => void run("SIGINT"));
    },
  };
}
