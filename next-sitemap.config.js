/** @type {import('next-sitemap').IConfig} */

const fetchStoryIds = require("./fetchThreadIds");

module.exports = {
  siteUrl: "https://hodam.vercel.app",
  generateRobotsTxt: true,
  sitemapSize: 5000,
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
  additionalPaths: async config => {
    const threadIds = await fetchStoryIds();

    // 기존의 추가 경로를 유지하며 my-story 경로 추가
    const additionalPaths = threadIds.map(id => ({
      loc: `${config.siteUrl}/my-story/${id}`,
      changefreq: "daily",
      priority: 0.8,
      lastmod: new Date().toISOString(),
    }));

    // 기존 경로 추가
    const existingPaths = [
      { loc: `${config.siteUrl}`, changefreq: "daily", priority: 1 },
      { loc: `${config.siteUrl}/bead`, changefreq: "daily", priority: 1 },
      { loc: `${config.siteUrl}/hodam`, changefreq: "daily", priority: 1 },
      { loc: `${config.siteUrl}/service`, changefreq: "daily", priority: 1 },
      { loc: `${config.siteUrl}/sign-in`, changefreq: "daily", priority: 1 },
      { loc: `${config.siteUrl}/my-story`, changefreq: "daily", priority: 1 },
    ];

    return [...existingPaths, ...additionalPaths];
  },
};
