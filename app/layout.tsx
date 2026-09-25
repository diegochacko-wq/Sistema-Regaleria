import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NegocioProvider } from "@/context/NegocioContext";
import ProveedorNotificaciones from "@/components/Notificaciones";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sistema de Gestión",
  description: "POS y Control de Negocio",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-neutral-950 text-neutral-100`}>
        {/* Envolvemos toda la app con el proveedor del negocio y el de notificaciones */}
        <NegocioProvider>
          <ProveedorNotificaciones>
            {children}
          </ProveedorNotificaciones>
        </NegocioProvider>
      </body>
    </html>
  );
}
