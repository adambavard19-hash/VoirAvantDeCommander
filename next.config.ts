import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // WebXR (réalité augmentée Android dans le navigateur) nécessite xr-spatial-tracking.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), xr-spatial-tracking=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["sharp", "unpdf"],
  images: { unoptimized: true },
  // Polices lues à l'exécution pour les PDF imprimables (QR codes) : à inclure dans le build autonome.
  outputFileTracingIncludes: {
    "/api/admin/restaurants/[id]/qr": ["./node_modules/@fontsource/manrope/files/*.woff", "./node_modules/@fontsource/fraunces/files/*.woff"],
    "/api/public/qr": ["./node_modules/@fontsource/manrope/files/*.woff", "./node_modules/@fontsource/fraunces/files/*.woff"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Les pages d'administration ne doivent jamais être indexées ni mises en cache partagé.
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
      {
        source: "/demo/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
    ];
  },
};

export default nextConfig;
