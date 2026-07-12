import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg-rgb) / <alpha-value>)",
        elev: "rgb(var(--elev-rgb) / <alpha-value>)",
        surface: "rgb(var(--surface-rgb) / <alpha-value>)",
        line: {
          DEFAULT: "var(--line)",
          strong: "var(--line-strong)",
        },
        fg: "rgb(var(--fg-rgb) / <alpha-value>)",
        muted: "rgb(var(--muted-rgb) / <alpha-value>)",
        faint: "rgb(var(--faint-rgb) / <alpha-value>)",
        // `ink` is the readable colour ON that ground. Anything drawn on
        // bg-accent must be text-accent-ink, never text-white — a brand with a
        // light accent flips it to near-black. Same for paper.
        accent: {
          DEFAULT: "rgb(var(--accent-rgb) / <alpha-value>)",
          soft: "var(--accent-soft)",
          hi: "rgb(var(--accent-hi-rgb) / <alpha-value>)",
          ink: "rgb(var(--accent-ink-rgb) / <alpha-value>)",
        },
        paper: {
          DEFAULT: "rgb(var(--paper-rgb) / <alpha-value>)",
          ink: "rgb(var(--paper-ink-rgb) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Impact", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        kicker: "0.22em",
      },
      maxWidth: {
        shell: "1240px",
      },
      borderRadius: {
        // The brand's corner. RNL is 3px; a partner can go sharp (0) or soft.
        brand: "var(--radius)",
      },
      keyframes: {
        // Slide a strip left by exactly its own width. Its identical twin sits
        // immediately to its right, so at the end of the cycle the twin is
        // pixel-for-pixel where the first strip started and the loop restarts
        // invisibly. (At -50% the pair only spanned 1.5 strip widths, which left
        // a blank band on screen whenever the strips were narrow.)
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-100%)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        glow: {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "0.9" },
        },
      },
      animation: {
        marquee: "marquee 40s linear infinite",
        "marquee-fast": "marquee 22s linear infinite",
        "fade-up": "fade-up 0.7s cubic-bezier(0.16,1,0.3,1) both",
        glow: "glow 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
