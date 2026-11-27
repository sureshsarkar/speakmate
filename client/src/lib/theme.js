import { hexToRgbTriplet } from './format';

/** Applies admin-configured theme colors (CSS variables) and the browser theme-color. */
export function applyTheme(theme) {
  if (!theme) return;
  const root = document.documentElement;
  const map = { primary: '--c-primary', secondary: '--c-secondary', light: '--c-light', text: '--c-text', background: '--c-bg' };
  for (const [key, cssVar] of Object.entries(map)) {
    if (/^#[0-9a-fA-F]{6}$/.test(theme[key] || '')) root.style.setProperty(cssVar, hexToRgbTriplet(theme[key]));
  }
  if (theme.primary) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.primary);
}
