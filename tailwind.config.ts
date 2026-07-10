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
        background: "#F0EEE6",
        surface: "#FAF9F5",
        foreground: "#1A1915",
        muted: "rgba(26,25,21,0.64)",
        subtle: "rgba(26,25,21,0.46)",
        accent: {
          DEFAULT: "#BD5D3A",
          hover: "#A94F31",
          active: "#93442A",
          soft: "rgba(189,93,58,0.08)",
          medium: "rgba(189,93,58,0.14)",
        },
        border: {
          DEFAULT: "rgba(26,25,21,0.10)",
          strong: "rgba(26,25,21,0.18)",
        },
        kil: {
          base: "#F0EEE6",
          bg: "#F0EEE6",
          surface: "#FAF9F5",
          card: "#FAF9F5",
          text: "#1A1915",
          accent: "#BD5D3A",
          border: "rgba(26,25,21,0.10)",
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['var(--font-lora)', 'Georgia', 'Times New Roman', 'ui-serif', 'serif'],
        mono: ['var(--font-jetbrains-mono)', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
export default config;
