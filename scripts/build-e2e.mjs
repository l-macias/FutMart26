import { spawn } from "node:child_process";

const packageManager = process.env.npm_execpath;
if (!packageManager) throw new Error("Run the E2E build through pnpm");

await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [packageManager, "build"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NEXT_PUBLIC_API_URL: "http://127.0.0.1:4000",
      NEXT_PUBLIC_AUTH_REQUIRE_EMAIL_VERIFICATION: "true",
      PRODUCTION_RUNTIME: "false",
    },
    stdio: "inherit",
    shell: false,
  });
  child.once("error", reject);
  child.once("exit", (code) =>
    code === 0 ? resolve() : reject(new Error(`E2E build exited with ${code}`)),
  );
});
