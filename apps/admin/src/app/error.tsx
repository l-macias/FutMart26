"use client";

export default function AdminError({ reset }: Readonly<{ reset: () => void }>) {
  return (
    <main>
      <h1>No pudimos cargar Operations.</h1>
      <p>Revisá la conexión o reintentá la consulta.</p>
      <button onClick={reset}>Reintentar</button>
    </main>
  );
}
