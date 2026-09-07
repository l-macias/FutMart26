"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";

import { adminApi } from "../lib/api";
import { authClient } from "../lib/auth";

const navigation = [
  ["/", "Resumen"],
  ["/players", "Jugadores"],
  ["/groups", "Grupos"],
  ["/matches", "Partidos"],
  ["/reports", "Reportes"],
  ["/system", "Sistema"],
  ["/errors", "Errores"],
  ["/audit", "Auditoría"],
] as const;

export function AdminGate({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
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

  if (session.isPending) return <State message="Verificando sesión…" />;
  if (!session.data?.user)
    return (
      <main className="auth-panel">
        <span className="eyebrow">CONSOLA OPERATIVA</span>
        <h1>F5 Operations</h1>
        <p className="muted">Acceso exclusivo para operadores autorizados.</p>
        <form action={(data) => void login(data)} className="stack">
          <label>
            Email
            <input autoComplete="email" name="email" type="email" required />
          </label>
          <label>
            Contraseña
            <input
              autoComplete="current-password"
              name="password"
              type="password"
              required
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button className="button-primary" disabled={pending} type="submit">
            {pending ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </main>
    );
  if (grant.isPending) return <State message="Comprobando autoridad…" />;
  if (grant.isError)
    return (
      <main className="auth-panel">
        <h1>Acceso denegado</h1>
        <p className="muted">Tu cuenta no posee autorización SUPERADMIN.</p>
        <button onClick={() => void logout()}>Cerrar sesión</button>
      </main>
    );

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/">
          F5 OPS
          <small>Consola operativa</small>
        </Link>
        <nav aria-label="Navegación administrativa" className="admin-nav">
          {navigation.map(([href, label]) => (
            <Link data-active={isActive(pathname, href)} href={href} key={href}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="admin-actor">
          <small>{session.data.user.email}</small>
          <button className="button-quiet" onClick={() => void logout()}>
            Salir
          </button>
        </div>
      </aside>
      <div className="admin-main">{children}</div>
    </div>
  );
}

function State({ message }: Readonly<{ message: string }>) {
  return (
    <main className="auth-panel">
      <p className="muted">{message}</p>
    </main>
  );
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}
