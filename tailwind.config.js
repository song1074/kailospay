// tailwind.config.js
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#0D0F2C", accent: "#3E66FB", soft: "#F5F7FF" },
      },
      maxWidth: { container: "72rem" },
      boxShadow: { header: "0 8px 30px rgba(0,0,0,0.06)" },
    },
  },
  plugins: [],
};
