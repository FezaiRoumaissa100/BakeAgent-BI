import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Le Croisic · Retail Intelligence",
  description: "Plateforme décisionnelle BI & Retail Intelligence — Boulangerie Le Croisic",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={inter.variable}>
      <body className={`${inter.className} antialiased`} style={{ background: "#f2ede6" }}>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
