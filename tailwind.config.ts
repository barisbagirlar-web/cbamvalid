import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#F0EDE8",
        surface: {
          DEFAULT: "#FAFAF8",
          secondary: "#F0EDE8",
          elevated: "#FFFFFF",
        },
        foreground: "#1A1A1A",
        ink: {
          DEFAULT: "#1A1A1A",
          secondary: "#4A4A45",
          muted: "#8A8A82",
        },
        muted: "#4A4A45",
        subtle: "#8A8A82",
        accent: {
          DEFAULT: "#1B4332",
          hover: "#2D6A4F",
          active: "#14532D",
          soft: "rgba(27,67,50,0.08)",
          medium: "rgba(27,67,50,0.14)",
        },
        forest: {
          DEFAULT: "#1B4332",
          light: "#2D6A4F",
          pale: "#D8F3DC",
        },
        seal: {
          DEFAULT: "#D4A017",
          light: "#E8C547",
        },
        border: {
          DEFAULT: "#D8D1C7",
          strong: "#A8A29E",
        },
        status: {
          blocked: "#9B2226",
          warning: "#BB6B00",
          pass: "#2D6A4F",
        },
        dark: {
          DEFAULT: "#1C1917",
          text: "#E7E5E4",
        },
        kil: {
          base: "#F0EDE8",
          bg: "#F0EDE8",
          surface: "#FAFAF8",
          card: "#FFFFFF",
          text: "#1A1A1A",
          accent: "#1B4332",
          border: "#D8D1C7",
        },
      },
      fontFamily: {
        sans: ['var(--font-source-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-source-serif)', 'Georgia', 'ui-serif', 'serif'],
        mono: ['var(--font-ibm-plex-mono)', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
export default config;
