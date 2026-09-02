import { eq } from "drizzle-orm";

import { createDatabase } from "@football/database";
import { adminGrants, authUser } from "@football/database/schema";

const emailArgument = process.argv.find((value) =>
  value.startsWith("--email="),
);
const email = emailArgument?.slice("--email=".length).trim().toLowerCase();
if (!email)
  throw new Error("Usage: pnpm admin:grant --email=operator@example.com");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const connection = createDatabase(process.env.DATABASE_URL);
try {
  const [user] = await connection.db
    .select({ id: authUser.id })
    .from(authUser)
    .where(eq(authUser.email, email))
    .limit(1);
  if (!user) throw new Error("Existing auth account not found");
  const inserted = await connection.db
    .insert(adminGrants)
    .values({ authUserId: user.id, role: "SUPERADMIN" })
    .onConflictDoNothing()
    .returning({ authUserId: adminGrants.authUserId });
  process.stdout.write(
    `${inserted[0] ? "SUPERADMIN granted" : "SUPERADMIN already granted"}\n`,
  );
} finally {
  await connection.close();
}
