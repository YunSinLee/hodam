/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./styles/**/*.{css,scss,sass}",

    // Or if using `src` directory:
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      height: {
        navbar: "82px",
        footer: "142px",
        "screen-navbar-footer": "calc(100vh - 82px - 142px)",
      },
    },
  },
  plugins: [
    ({ addUtilities }) => {
      addUtilities({
        ".clickable-layer": {
          "@apply hover:bg-gray-200 cursor-pointer": "",
        },
      });
    },
  ],
};
