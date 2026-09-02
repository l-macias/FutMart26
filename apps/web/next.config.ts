import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  allowedDevOrigins: ["127.0.0.1"],
  reactStrictMode: true,
  headers() {
    return Promise.resolve([{ source: "/(.*)", headers: securityHeaders() }]);
  },
};

function securityHeaders() {
  const apiOrigin = publicApiUrl();
  const headers = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=()",
    },
    {
      key: "Content-Security-Policy",
      value: [
        "default-src 'self'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
        "object-src 'none'",
        `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"}`,
        "style-src 'self' 'unsafe-inline'",
        `connect-src 'self' ${apiOrigin}`,
        `img-src 'self' data: blob: ${apiOrigin}`,
        "font-src 'self' data:",
        "form-action 'self'",
      ].join("; "),
    },
  ];
  if (process.env.NODE_ENV === "production")
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains",
    });
  return headers;
}

function publicApiUrl() {
  const value = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  if (
    process.env.PRODUCTION_RUNTIME === "true" &&
    !value.startsWith("https://")
  )
    throw new Error("NEXT_PUBLIC_API_URL must use HTTPS in production");
  return value;
}

export default nextConfig;
