import { VerifyEmailScreen } from "@/features/auth/auth-flow-screen";

export default async function VerifyEmailPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    error?: string;
    sent?: string;
    verified?: string;
  }>;
}>) {
  const params = await searchParams;
  return (
    <VerifyEmailScreen
      errorCode={params.error}
      sent={params.sent === "1"}
      verified={params.verified === "1"}
    />
  );
}
