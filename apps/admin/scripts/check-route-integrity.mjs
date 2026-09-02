import { access } from "node:fs/promises";
import { join } from "node:path";

const pages = [
  "page.tsx",
  "players/[playerId]/page.tsx",
  "groups/[groupId]/page.tsx",
  "matches/[matchId]/page.tsx",
  "reports/page.tsx",
  "reports/[reportId]/page.tsx",
  "audit/page.tsx",
];
await Promise.all(pages.map((page) => access(join("src/app", page))));
process.stdout.write(`Admin route integrity: ${pages.length} pages\n`);
