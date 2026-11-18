import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache le bouton « N » de Next.js en développement : il recouvrait le bouton « Saisir le stock » de la barre latérale.
  devIndicators: false,
};

export default nextConfig;
