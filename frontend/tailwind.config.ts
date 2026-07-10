import type { Config } from "tailwindcss";

// Dark-first palette (same chassis as ConcertFinder/BirdTracker): near-black
// canvas, muted slate chrome. Accents: aurora green (primary), glacial ice
// blue, amber warnings, red danger — fixed across themes.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Chrome colors are CSS variables (RGB triplets → /alpha modifiers work).
        canvas: "rgb(var(--c-canvas) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        "surface-2": "rgb(var(--c-surface-2) / <alpha-value>)",
        border: "rgb(var(--c-border) / <alpha-value>)",
        muted: "rgb(var(--c-muted) / <alpha-value>)",
        fg: "rgb(var(--c-fg) / <alpha-value>)",
        strong: "rgb(var(--c-strong) / <alpha-value>)",
        aurora: { DEFAULT: "#34d399", dim: "#059669" },
        ice: { DEFAULT: "#38bdf8", dim: "#0284c7" },
        warn: "#f59e0b",
        danger: "#ef4444",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
