import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegistrarServiceWorker } from "./registrar-sw";

export const metadata: Metadata = {
  title: "Gestão de Fazenda",
  description: "Cria-recria + leite — sul do Maranhão. Custo por arroba, ponto de equilíbrio e prioridade da semana.",
  manifest: "/manifest.json",
  icons: [{ rel: "icon", url: "/icons/icon.svg" }],
};

export const viewport: Viewport = {
  themeColor: "#33492A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function LayoutRaiz({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <RegistrarServiceWorker />
        {children}
      </body>
    </html>
  );
}
