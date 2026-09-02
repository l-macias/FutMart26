import Link from "next/link";
import { Text } from "@football/ui";

export default function NotFound() {
  return (
    <main className="app-state-page">
      <Text tone="accent" variant="label">
        404 · SIN PARTIDO
      </Text>
      <Text as="h1" variant="display-lg">
        Esta ruta no existe.
      </Text>
      <Text tone="muted">
        Volvé al mundo F5 y seguí desde una pantalla válida.
      </Text>
      <Link className="ui-button ui-button--primary" href="/">
        Ir al inicio
      </Link>
    </main>
  );
}
