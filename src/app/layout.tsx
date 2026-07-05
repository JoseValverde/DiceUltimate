import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DiceUltimate",
  description: "Tiradas de dados en vivo para juegos de mesa y rol",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
