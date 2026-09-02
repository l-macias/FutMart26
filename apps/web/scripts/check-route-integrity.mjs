import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const appRoot = join(webRoot, "src", "app");

const canonicalPages = [
  "(player)/page.tsx",
  "(player)/play/page.tsx",
  "(player)/profile/page.tsx",
  "(player)/profile/edit/page.tsx",
  "(player)/profile/preferences/page.tsx",
  "(player)/profile/progression/page.tsx",
  "(player)/profile/account/page.tsx",
  "(player)/players/page.tsx",
  "(player)/players/[playerId]/page.tsx",
  "(player)/connections/page.tsx",
  "(player)/invitations/page.tsx",
  "(player)/notifications/page.tsx",
  "(player)/groups/page.tsx",
  "(player)/groups/[groupId]/page.tsx",
  "(player)/groups/[groupId]/settings/page.tsx",
  "(player)/groups/[groupId]/matches/new/page.tsx",
  "(player)/groups/[groupId]/ranking/page.tsx",
  "(player)/play/matches/[matchId]/page.tsx",
  "(player)/play/matches/[matchId]/edit/page.tsx",
  "(player)/play/matches/[matchId]/teams/page.tsx",
  "(player)/play/matches/[matchId]/close/page.tsx",
  "(player)/play/matches/[matchId]/voting/page.tsx",
  "(player)/play/matches/[matchId]/progression/page.tsx",
  "(player)/rankings/page.tsx",
  "(player)/rankings/global/page.tsx",
  "(player)/rankings/venues/[venueId]/page.tsx",
  "(player)/rankings/cities/[cityKey]/page.tsx",
  "(player)/rankings/provinces/[provinceKey]/page.tsx",
  "(player)/rankings/countries/[countryKey]/page.tsx",
  "auth/page.tsx",
  "auth/forgot-password/page.tsx",
  "auth/reset-password/page.tsx",
  "auth/verify-email/page.tsx",
  "onboarding/compliance/page.tsx",
  "terms/page.tsx",
  "suspended/page.tsx",
  "privacy/page.tsx",
  "support/page.tsx",
  "invite/[token]/page.tsx",
];

const missing = canonicalPages.filter(
  (relativePath) => !existsSync(join(appRoot, relativePath)),
);

if (missing.length > 0) {
  throw new Error(
    `Missing canonical App Router pages:\n${missing.map((path) => `- ${path}`).join("\n")}`,
  );
}

console.log(
  `Route integrity: ${canonicalPages.length} canonical pages present.`,
);
