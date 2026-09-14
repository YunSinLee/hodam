/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https://")
    ? process.env.NEXT_PUBLIC_SITE_URL
    : "https://hodam.vercel.app",
  generateRobotsTxt: true,
  changefreq: "weekly",
  priority: 0.7,
  exclude: [
    "/api/*",
    "/auth/*",
    "/sign-in",
    "/profile",
    "/my-story",
    "/my-story/*",
    "/payment/*",
    "/payment-history",
    "/bead",
    "/service",
    "/hodam",
  ],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/auth/",
          "/profile",
          "/my-story",
          "/payment",
          "/bead",
          "/service",
          "/sign-in",
        ],
      },
    ],
  },
};
