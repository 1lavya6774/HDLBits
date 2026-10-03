/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: {
          base: "#0b0e14",
          surface: "#121820",
          elevated: "#1a222d",
        },
        border: {
          base: "#1f2937",
          subtle: "#232d3b",
          highlight: "#374151",
        },
        logic: {
          high: "#10b981",
          low: "#10b981",
          bus: "#38bdf8",
          unknown: "#ef4444",
          highz: "#eab308",
          cursor: "#facc15",
        },
      },
      fontFamily: {
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "Courier New",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};

