/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/app/**/*.{js,jsx,ts,tsx}', './src/components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Ported verbatim from fuelplan-frontend/src/styles/global.css
        lime: '#c8f542',
        'lime-dim': '#9fcc2e',
        bg: '#0e0f11',
        bg2: '#13151a',
        card: '#1e2128',
        card2: '#252830',
        border: '#2a2d35',
        border2: '#363a46',
        text: '#f0f2f5',
        muted: '#7a8099',
        red: '#ff5757',
        blue: '#57a9ff',
        orange: '#ff9a42',
        // Light theme variants — referenced as light-bg, light-card, etc.
        // and applied via NativeWind's dark: variant (dark is the default
        // palette above, light overrides via `dark:` on the *inverse* —
        // see ThemeContext port note in CLAUDE.md for the actual pattern).
        'light-bg': '#f0f2f5',
        'light-bg2': '#e4e7ed',
        'light-card': '#ffffff',
        'light-card2': '#f7f8fa',
        'light-border': '#d8dce6',
        'light-border2': '#c4c9d8',
        'light-text': '#0e0f11',
        'light-muted': '#5a6280',
      },
      // expo-font's useFonts() registers each loaded weight as its own
      // distinct font-family name (e.g. "Syne_800ExtraBold"), not a single
      // "Syne" family with weight variants the way CSS @font-face normally
      // works — so these must reference the exact loaded names (see
      // src/app/_layout.tsx's useFonts() call), not the bare family name,
      // or every Text silently falls back to the system font.
      fontFamily: {
        display: ['Syne_800ExtraBold'],
        body: ['Figtree_400Regular'],
      },
    },
  },
  plugins: [],
}
