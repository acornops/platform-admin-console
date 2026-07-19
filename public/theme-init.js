(() => {
  const storageKey = "app_theme";
  let saved = "system";
  try { saved = localStorage.getItem(storageKey) || "system"; } catch { /* Storage is optional. */ }
  const preference = ["system", "light", "dark"].includes(saved) ? saved : "system";
  const resolved = preference === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : preference;
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.dataset.resolvedTheme = resolved;
  document.documentElement.style.colorScheme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolved === "dark" ? "#121110" : "#7f4b3b");
})();
