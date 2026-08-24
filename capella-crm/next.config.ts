import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Le dossier parent contient d'autres projets (site vitrine, v3).
  // On indique explicitement la racine pour que Next.js ne s'y perde pas.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
