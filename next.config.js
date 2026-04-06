const API_KEY = process.env.API_KEY;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/contact",
        destination: "/form",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/movies",
        destination: `https://api.themoviedb.org/3/movie/popular?api_key=${API_KEY}`,
      },
      {
        source: "/api/movies/:id",
        destination: `https://api.themoviedb.org/3/movie/:id?api_key=${API_KEY}`,
      },
    ];
  },
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
  crossOrigin: "anonymous",
};

module.exports = nextConfig;
