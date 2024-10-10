// fetchStoryIds.js
const sitemapApi = require("./src/app/api/sitemap.ts");

const fetchStoryIds = async () => {
  const threads = await sitemapApi.fetchAllThreads();
  return threads.map(thread => thread.id);
};

module.exports = fetchStoryIds;
