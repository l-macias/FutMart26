const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class AdminApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

export async function adminApi<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new AdminApiError(0, "network_error");
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new AdminApiError(response.status, payload?.error ?? "unknown_error");
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
