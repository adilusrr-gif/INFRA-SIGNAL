import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "INFRA-SIGNAL — AI диспетчер инфраструктуры",
  description: "Интерактивное демо системы раннего обнаружения аварий городской инфраструктуры.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
