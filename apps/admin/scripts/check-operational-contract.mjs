import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [gate, home, resource, reports, errors] = await Promise.all([
  readFile("src/components/admin-gate.tsx", "utf8"),
  readFile("src/app/page.tsx", "utf8"),
  readFile("src/components/resource-screen.tsx", "utf8"),
  readFile("src/app/reports/[reportId]/page.tsx", "utf8"),
  readFile("src/app/errors/page.tsx", "utf8"),
]);

for (const destination of [
  "/players",
  "/groups",
  "/matches",
  "/reports",
  "/system",
  "/errors",
  "/audit",
]) {
  assert.match(gate, new RegExp(`"${destination}"`));
}
assert.doesNotMatch(
  `${home}${resource}${reports}`,
  /Target ID|JSON\.stringify\(report\.data|<pre>/,
);
assert.match(resource, /Motivo/);
assert.match(resource, /ConfirmAction/);
assert.match(errors, /No es un visor de logs/);
assert.match(errors, /Retención en memoria/);

process.stdout.write("Admin operational contract: OK\n");
