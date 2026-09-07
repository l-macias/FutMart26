import type { Metadata } from "next";
import { Barlow_Condensed, Manrope } from "next/font/google";
import type { ReactNode } from "react";

import { AppProviders } from "./providers";
import "@football/ui/styles.css";
import "./styles.css";
import { AdminGate } from "../components/admin-gate";

export const metadata: Metadata = {
  title: "F5 Groups Admin",
  description: "F5 Groups administration application",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${displayFont.variable} ${interfaceFont.variable}`}>
        <AppProviders>
          <AdminGate>{children}</AdminGate>
        </AppProviders>
      </body>
    </html>
  );
}
const displayFont = Barlow_Condensed({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700", "800"],
});

const interfaceFont = Manrope({
  subsets: ["latin"],
  variable: "--font-interface",
});
