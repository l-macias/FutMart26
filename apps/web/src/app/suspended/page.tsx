"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";

export default function SuspendedPage() {
  const router = useRouter();
  async function logout() {
    await authClient.signOut();
    router.replace("/auth");
  }
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "5rem 1.5rem" }}>
      <p>F5 · ACCOUNT STATUS</p>
      <h1>Tu acceso está temporalmente suspendido.</h1>
      <p>
        Tu historia deportiva no fue eliminada. Para revisar el estado de la
        cuenta, contactá al equipo de soporte.
      </p>
      <p>
        <Link href="/support">Ir a soporte</Link>
      </p>
      <button onClick={() => void logout()} type="button">
        Cerrar sesión
      </button>
    </main>
  );
}
