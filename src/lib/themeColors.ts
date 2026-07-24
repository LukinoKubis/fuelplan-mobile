// For the cases where a component needs a color value in JS (inline style,
// an SVG stroke, a conditional computed color) rather than a static
// className — NativeWind's dark:/light- className pairs (see CLAUDE.md)
// only work for static Tailwind classes, not JS values. Mirrors the same
// hex values defined in tailwind.config.js.
import { useTheme } from '../state/ThemeContext'

const DARK = {
  lime: '#c8f542',
  limeDim: '#9fcc2e',
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
}

const LIGHT = {
  ...DARK,
  bg: '#f0f2f5',
  bg2: '#e4e7ed',
  card: '#ffffff',
  card2: '#f7f8fa',
  border: '#d8dce6',
  border2: '#c4c9d8',
  text: '#0e0f11',
  muted: '#5a6280',
}

/** Returns the current theme's hex palette, re-evaluated whenever the theme toggles. */
export function useThemeColors() {
  const { theme } = useTheme()
  return theme === 'light' ? LIGHT : DARK
}
