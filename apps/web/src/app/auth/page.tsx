import { AuthScreen } from "@/features/auth/auth-screen";
import { safeReturnTo } from "@/lib/auth/auth-client";

export default async function AuthPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ returnTo?: string }> }>) {
  const params = await searchParams;
  return <AuthScreen returnTo={safeReturnTo(params.returnTo ?? null)} />;
}
