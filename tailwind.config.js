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
        footer: "240px",
        "screen-navbar-footer": "calc(100vh - 82px - 240px)",
      },
      keyframes: {
        "sound-wave1": {
          "0%, 100%": { height: "5px", top: "7px" },
          "50%": { height: "12px", top: "0px" },
        },
        "sound-wave2": {
          "0%, 100%": { height: "8px", top: "4px" },
          "40%": { height: "12px", top: "0px" },
        },
        "sound-wave3": {
          "0%, 100%": { height: "6px", top: "6px" },
          "60%": { height: "12px", top: "0px" },
        },
      },
      animation: {
        "sound-wave1": "sound-wave1 0.8s infinite ease-in-out",
        "sound-wave2": "sound-wave2 0.9s infinite ease-in-out",
        "sound-wave3": "sound-wave3 0.7s infinite ease-in-out",
      },
    },
  },
  corePlugins: {
    preflight: false, // PrimeReact 스타일과의 충돌 방지
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
