const { assertSafePublicEnv } = require("./scripts/lib/public-env-safety.cjs");

// Next loads .env files before this module. Reject server credentials before
// either the development server or production build can publish a client bundle.
assertSafePublicEnv();

/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  crossOrigin: "anonymous",
  poweredByHeader: false,
  webpack(config, { isServer }) {
    if (isServer) {
      const existingIgnoreWarnings = Array.isArray(config.ignoreWarnings)
        ? config.ignoreWarnings
        : [];

      config.ignoreWarnings = [
        ...existingIgnoreWarnings,
        {
          module:
            /@prisma\/instrumentation\/node_modules\/@opentelemetry\/instrumentation/,
        },
      ];
    }

    return config;
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};
