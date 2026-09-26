import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Tableau de Bord BI",
  description: "Plateforme décisionnelle BI & Intelligence Retail",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={inter.variable}>
      <body className={`${inter.className} antialiased`} style={{ background: "#f2ede6" }}>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto">
            <Navbar />
            <div style={{ paddingTop: "40px", paddingBottom: "40px" }}>
              {children}
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
