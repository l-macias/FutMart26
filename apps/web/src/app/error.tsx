"use client";

import { Button, Text } from "@football/ui";

export default function GlobalError({
  reset,
}: Readonly<{ reset: () => void }>) {
  return (
    <main className="app-state-page">
      <Text tone="accent" variant="label">
        FUERA DE JUEGO
      </Text>
      <Text as="h1" variant="display-lg">
        Esta pantalla no pudo cargar.
      </Text>
      <Text tone="muted">
        Tu sesión y tus datos siguen a salvo. Podés intentar nuevamente.
      </Text>
      <Button onClick={reset}>Reintentar</Button>
    </main>
  );
}
