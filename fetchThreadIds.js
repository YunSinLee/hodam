// fetchStoryIds.js
const threadApi = require("@/app/api/thread");

const fetchStoryIds = async () => {
  const threads = await threadApi.fetchAllThreads();
  return threads.map(thread => thread.id);
};

module.exports = fetchStoryIds;
