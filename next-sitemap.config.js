/** @type {import('next-sitemap').IConfig} */

const fetchStoryIds = require("./fetchStoryIds");

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
  additionalPaths: async config => {
    const threadIds = await fetchStoryIds();

    return threadIds.map(id => ({
      loc: `${config.siteUrl}/my-story/${id}`, // 각 스레드 페이지의 URL 추가
      changefreq: "daily",
      priority: 0.8,
      lastmod: new Date().toISOString(),
    }));
  },
};
