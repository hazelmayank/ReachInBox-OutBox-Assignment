/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1d1f1e",
        mint: { 50: "#f4fbf7", 100: "#e4f6ec", 500: "#16a765", 600: "#0d8f53" }
      },
      boxShadow: { soft: "0 12px 40px rgba(23, 42, 32, 0.08)" }
    }
  },
  plugins: []
};
