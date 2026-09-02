"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";

import { adminApi } from "../lib/api";
import { authClient } from "../lib/auth";

export function AdminGate({ children }: Readonly<{ children: ReactNode }>) {
  const session = authClient.useSession();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const grant = useQuery({
    queryKey: ["admin", "session"],
    queryFn: () => adminApi<{ role: "SUPERADMIN" }>("/admin/session"),
    enabled: Boolean(session.data?.user),
    retry: false,
  });
  async function login(formData: FormData) {
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await authClient.signIn.email({
        email: formValue(formData, "email"),
        password: formValue(formData, "password"),
      });
      if (result.error) setError("No pudimos validar las credenciales.");
      else await session.refetch();
    } catch {
      setError("No pudimos conectar con el servidor de autenticación.");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }
  async function logout() {
    await authClient.signOut();
    queryClient.clear();
    await session.refetch();
  }
  if (session.isPending)
    return (
      <main>
        <p>Verificando sesión…</p>
      </main>
    );
  if (!session.data?.user)
    return (
      <main className="auth-panel">
        <h1>F5 Operations</h1>
        <p>Acceso exclusivo para operadores autorizados.</p>
        <form action={(data) => void login(data)} className="stack">
          <label>
            Email
            <input name="email" type="email" required />
          </label>
          <label>
            Contraseña
            <input name="password" type="password" required />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button disabled={pending} type="submit">
            {pending ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </main>
    );
  if (grant.isPending)
    return (
      <main>
        <p>Comprobando autoridad…</p>
      </main>
    );
  if (grant.isError)
    return (
      <main>
        <h1>Acceso denegado</h1>
        <p>Tu cuenta no posee un grant SUPERADMIN.</p>
        <button onClick={() => void logout()}>Cerrar sesión</button>
      </main>
    );
  return (
    <div className="admin-shell">
      <header>
        <Link href="/">F5 OPS</Link>
        <nav>
          <Link href="/reports">Reportes</Link>
          <Link href="/audit">Auditoría</Link>
        </nav>
        <button onClick={() => void logout()}>Salir</button>
      </header>
      {children}
    </div>
  );
}

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}
