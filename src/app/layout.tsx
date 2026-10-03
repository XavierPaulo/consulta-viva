import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { getClinic } from "@/lib/clinic";

// Os dados da clínica (nome, cor, textos) são editáveis no painel: sempre renderizar na hora.
export const dynamic = "force-dynamic";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const clinic = await getClinic();
  return {
    title: { default: `${clinic.name} – Agende sua consulta`, template: `%s · ${clinic.name}` },
    description: clinic.tagline || clinic.about.slice(0, 150),
  };
}

export const viewport: Viewport = { themeColor: "#0f766e", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const clinic = await getClinic();
  const brand = /^#[0-9a-f]{6}$/i.test(clinic.primaryColor) ? clinic.primaryColor : "#0f766e";
  return (
    <html lang="pt-BR" className={`${inter.variable} antialiased`} style={{ ["--brand" as string]: brand }}>
      <body className="flex min-h-dvh flex-col">{children}</body>
    </html>
  );
}
