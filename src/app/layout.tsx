import type { Metadata } from "next";

import { serverEnv } from "@/lib/config/env";

import "./globals.css";

export const metadata: Metadata = {
  title: "L'Essenc Digital",
  description: "Plataforma digital oficial da L'Essenc.",
  metadataBase: new URL(serverEnv.APP_URL),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
