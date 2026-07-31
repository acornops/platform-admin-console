const themeStorageKey = 'app_theme';

let savedTheme = 'system';
try {
  savedTheme = localStorage.getItem(themeStorageKey) || 'system';
} catch {
  // Storage is optional; the system preference remains usable.
}

const themePreference = ['system', 'light', 'dark'].includes(savedTheme) ? savedTheme : 'system';
const resolvedTheme = themePreference === 'system'
  ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  : themePreference;

document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
document.documentElement.dataset.themePreference = themePreference;
document.documentElement.dataset.resolvedTheme = resolvedTheme;
document.documentElement.style.colorScheme = resolvedTheme;
document.querySelector('meta[name="theme-color"]')?.setAttribute(
  'content',
  resolvedTheme === 'dark' ? '#121110' : '#7f4b3b'
);
