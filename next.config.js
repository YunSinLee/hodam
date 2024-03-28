const API_KEY = process.env.API_KEY;
const OPEN_AI_API_KEY = process.env.OPEN_AI_API_KEY;

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
      {
        source: "/api/image/:u",
        destination:
          "https://oaidalleapiprodscus.blob.core.windows.net/private/org-HY3hV47Mlz7pgPA4Nn9UDu2b/user-iAVqxuQjNQw6ATk0k2X93rIc/img-suMG4qdp0g4B2Sif9efhGz1q.png?st=2024-03-27T10%3A33%3A38Z&se=2024-03-27T12%3A33%3A38Z&sp=r&sv=2021-08-06&sr=b&rscd=inline&rsct=image/png&skoid=6aaadede-4fb3-4698-a8f6-684d7786b067&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2024-03-26T21%3A22%3A43Z&ske=2024-03-27T21%3A22%3A43Z&sks=b&skv=2021-08-06&sig=72dmZTdx9XwetuFDhYJ%2Bir22pPzi8lxRXwKBwJzENrQ%3D",
      },
    ];
  },
  env: {
    OPEN_AI_API_KEY,
  },
  crossOrigin: "anonymous",
};

module.exports = nextConfig;
