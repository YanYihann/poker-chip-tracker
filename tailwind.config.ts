import type { Config } from "tailwindcss";

const palette = (token: string) => `color-mix(in srgb, var(${token}) calc(<alpha-value> * 100%), transparent)`;

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        stitch: {
          background: palette("--stitch-background"),
          surface: palette("--stitch-surface"),
          surfaceBright: palette("--stitch-surface-bright"),
          surfaceContainer: palette("--stitch-surface-container"),
          surfaceContainerHigh: palette("--stitch-surface-container-high"),
          surfaceContainerHighest: palette("--stitch-surface-container-highest"),
          surfaceContainerLowest: palette("--stitch-surface-container-lowest"),
          surfaceVariant: palette("--stitch-surface-variant"),
          outlineVariant: palette("--stitch-outline-variant"),
          primary: palette("--stitch-primary"),
          primaryContainer: palette("--stitch-primary-container"),
          onPrimary: palette("--stitch-on-primary"),
          onPrimaryContainer: palette("--stitch-on-primary-container"),
          mint: palette("--stitch-mint"),
          mintDim: palette("--stitch-mint-dim"),
          tertiary: palette("--stitch-tertiary"),
          onSurface: palette("--stitch-on-surface"),
          onSurfaceVariant: palette("--stitch-on-surface-variant")
        }
      },
      fontFamily: {
        headline: ["var(--font-headline)", "var(--font-apple-zh)"],
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
