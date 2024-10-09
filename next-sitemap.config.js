/** @type {import('next-sitemap').IConfig} */

module.exports = {
  siteUrl: "https://hodam.vercel.app",
  generateRobotsTxt: true,
  sitemapSize: 5000, // 단일 파일로 생성하도록 설정
  changefreq: "daily",
  priority: 1,
  robotsTxtOptions: {
    policies: [
      {
        userAgent: "*",
        allow: "/",
      },
    ],
  },
};
