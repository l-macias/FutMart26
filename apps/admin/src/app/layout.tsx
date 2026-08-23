import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppProviders } from "./providers";
import "./styles.css";

export const metadata: Metadata = {
  title: "F5 Groups Admin",
  description: "F5 Groups administration application",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
