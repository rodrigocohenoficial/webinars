import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Webinario",
  description: "Webinario online",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh bg-[var(--fundo)] text-[var(--texto)] antialiased">{children}</body>
    </html>
  );
}
