import type { Config } from "tailwindcss";

/**
 * Warm, natural palette — bamboo tan/green, NOT generic SaaS blue.
 * See PLAN.md section 3G (landing / visual identity).
 */
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bamboo: {
          50: "#f7f5ef",
          100: "#ece7d8",
          200: "#d9cfb2",
          300: "#c2b184",
          400: "#ad975f",
          500: "#9a8248",
          600: "#7d683a",
          700: "#635130",
          800: "#54452c",
          900: "#493c29",
        },
        leaf: {
          50: "#f2f7f0",
          100: "#e0ecdb",
          200: "#c2d9b9",
          300: "#9bbf8d",
          400: "#72a061",
          500: "#538343",
          600: "#3f6833",
          700: "#33522a",
          800: "#2b4224",
          900: "#25381f",
        },
        clay: {
          400: "#c07a4a",
          500: "#a9623a",
          600: "#8c4e2e",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
