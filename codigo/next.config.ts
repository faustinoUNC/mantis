import type { NextConfig } from "next";

// Redeploy trigger: forzar un nuevo build en Vercel tras un fallo previo.

// STORY-930: headers de seguridad aditivos (anti-clickjacking + hardening).
// Sin CSP a propósito (riesgo de romper la hidratación de Next). HSTS ya lo pone Vercel.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
