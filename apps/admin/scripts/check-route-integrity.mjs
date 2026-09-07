import { access } from "node:fs/promises";
import { join } from "node:path";

const pages = [
  "page.tsx",
  "players/page.tsx",
  "players/[playerId]/page.tsx",
  "groups/page.tsx",
  "groups/[groupId]/page.tsx",
  "matches/page.tsx",
  "matches/[matchId]/page.tsx",
  "reports/page.tsx",
  "reports/[reportId]/page.tsx",
  "audit/page.tsx",
  "system/page.tsx",
  "errors/page.tsx",
];
await Promise.all(pages.map((page) => access(join("src/app", page))));
process.stdout.write(`Admin route integrity: ${pages.length} pages\n`);
