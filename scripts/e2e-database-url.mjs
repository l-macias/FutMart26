export function e2eDatabaseUrl(environment = process.env) {
  const explicit = environment.E2E_DATABASE_URL;
  const source = explicit ?? environment.TEST_DATABASE_URL;
  if (!source)
    throw new Error("E2E_DATABASE_URL or TEST_DATABASE_URL is required");
  const url = new URL(source);
  const databaseName = explicit
    ? decodeURIComponent(url.pathname.slice(1))
    : "football_e2e";
  if (!/^football_e2e(?:_[a-z0-9_-]+)?$/i.test(databaseName))
    throw new Error("E2E database name must start with football_e2e");
  url.pathname = `/${databaseName}`;
  return url.toString();
}
