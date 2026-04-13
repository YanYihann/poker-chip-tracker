import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        stitch: {
          background: "#00180d",
          surface: "#00180d",
          surfaceBright: "#1d402f",
          surfaceContainer: "#012517",
          surfaceContainerHigh: "#0c3021",
          surfaceContainerHighest: "#193b2b",
          surfaceContainerLowest: "#001209",
          surfaceVariant: "#193b2b",
          outlineVariant: "#4d4635",
          primary: "#f2ca50",
          primaryContainer: "#d4af37",
          onPrimary: "#3c2f00",
          onPrimaryContainer: "#554300",
          mint: "#24ffcd",
          mintDim: "#00e0b3",
          tertiary: "#ffbeb9",
          onSurface: "#c5ebd4",
          onSurfaceVariant: "#d0c5af"
        }
      },
      fontFamily: {
        headline: ["var(--font-headline)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
        label: ["var(--font-label)", "sans-serif"]
      },
      borderRadius: {
        xl2: "1.25rem",
        xl3: "1.5rem"
      }
    }
  },
  plugins: []
};

export default config;
