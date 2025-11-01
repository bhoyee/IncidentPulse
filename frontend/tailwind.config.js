/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f7ff",
          100: "#d6e8ff",
          200: "#adcfff",
          300: "#7bb2ff",
          400: "#4f96ff",
          500: "#1f7bff",
          600: "#0d5ee6",
          700: "#0847b4",
          800: "#083c8e",
          900: "#0a2b66"
        },
        severity: {
          low: "#15803d",
          medium: "#f97316",
          high: "#ef4444",
          critical: "#b91c1c"
        }
      }
    }
  },
  plugins: [require("@tailwindcss/forms")]
};
