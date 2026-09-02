import { ResetPasswordScreen } from "@/features/auth/auth-flow-screen";

export default async function ResetPasswordPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ error?: string; token?: string }>;
}>) {
  const params = await searchParams;
  return <ResetPasswordScreen errorCode={params.error} token={params.token} />;
}
