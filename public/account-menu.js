const THEME_STORAGE_KEY = "app_theme";
const THEME_PREFERENCES = ["system", "light", "dark"];

export function parseThemePreference(value) {
  return THEME_PREFERENCES.includes(value) ? value : "system";
}

export function resolveThemePreference(preference, prefersDark) {
  return preference === "system" ? (prefersDark ? "dark" : "light") : preference;
}

export function administratorInitials(identity = {}) {
  const source = identity.displayName || identity.email || identity.subject || "Platform administrator";
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : source.slice(0, 2)).toUpperCase();
}

function readThemePreference() {
  try { return parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY)); }
  catch { return "system"; }
}

function persistThemePreference(preference) {
  try { localStorage.setItem(THEME_STORAGE_KEY, preference); }
  catch { /* Appearance still applies for this page. */ }
}

function themeIcon(theme) {
  if (theme === "dark") return '<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg>';
  return '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/></svg>';
}

export function bindAdminAccountMenu({ onLogout, onError = () => {} }) {
  const root = document.documentElement;
  const accountRoot = document.querySelector(".admin-account-bar");
  const accountTrigger = document.querySelector("#admin-account-trigger");
  const accountMenu = document.querySelector("#admin-account-menu");
  const themeTrigger = document.querySelector("#theme-menu-trigger");
  const themeMenu = document.querySelector("#theme-menu");
  const themeItems = [...themeMenu.querySelectorAll("[data-theme-preference]")];
  const logoutButton = document.querySelector("#admin-logout");
  const mediaQuery = matchMedia("(prefers-color-scheme: dark)");
  let preference = readThemePreference();

  function updateTheme() {
    const resolved = resolveThemePreference(preference, mediaQuery.matches);
    root.dataset.themePreference = preference;
    root.dataset.resolvedTheme = resolved;
    root.style.colorScheme = resolved;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolved === "dark" ? "#121110" : "#7f4b3b");
    document.querySelector("[data-theme-icon]").innerHTML = themeIcon(resolved);
    document.querySelector("#theme-preference-label").textContent = `${preference[0].toUpperCase()}${preference.slice(1)}`;
    themeTrigger.setAttribute("aria-label", `Open theme menu, current theme ${preference}`);
    themeItems.forEach((item) => {
      const selected = item.dataset.themePreference === preference;
      item.setAttribute("aria-checked", String(selected));
      item.tabIndex = selected ? 0 : -1;
    });
  }

  function closeTheme({ restoreFocus = false } = {}) {
    themeMenu.hidden = true;
    themeTrigger.setAttribute("aria-expanded", "false");
    if (restoreFocus) themeTrigger.focus({ preventScroll: true });
  }

  function closeAccount({ restoreFocus = false } = {}) {
    closeTheme();
    accountMenu.hidden = true;
    accountTrigger.setAttribute("aria-expanded", "false");
    if (restoreFocus) accountTrigger.focus({ preventScroll: true });
  }

  function openTheme(focusPreference = true) {
    themeMenu.hidden = false;
    themeTrigger.setAttribute("aria-expanded", "true");
    if (focusPreference) themeItems.find((item) => item.dataset.themePreference === preference)?.focus({ preventScroll: true });
  }

  accountTrigger.addEventListener("click", () => {
    const opening = accountMenu.hidden;
    accountMenu.hidden = !opening;
    accountTrigger.setAttribute("aria-expanded", String(opening));
    if (!opening) closeTheme();
  });
  themeTrigger.addEventListener("click", () => themeMenu.hidden ? openTheme(false) : closeTheme());
  themeTrigger.addEventListener("keydown", (event) => {
    if (["ArrowDown", "ArrowUp"].includes(event.key) && themeMenu.hidden) { event.preventDefault(); openTheme(); }
  });
  themeMenu.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeTheme({ restoreFocus: true }); return; }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const current = themeItems.indexOf(document.activeElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? themeItems.length - 1 : event.key === "ArrowDown" ? (current + 1) % themeItems.length : (current - 1 + themeItems.length) % themeItems.length;
    themeItems[next].focus({ preventScroll: true });
  });
  themeItems.forEach((item) => item.addEventListener("click", () => {
    preference = parseThemePreference(item.dataset.themePreference);
    persistThemePreference(preference);
    updateTheme();
    closeTheme({ restoreFocus: true });
  }));
  document.addEventListener("mousedown", (event) => { if (!accountRoot.contains(event.target)) closeAccount(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !accountMenu.hidden) { event.preventDefault(); closeAccount({ restoreFocus: true }); } });
  mediaQuery.addEventListener("change", () => { if (preference === "system") updateTheme(); });
  logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    logoutButton.querySelector("strong").textContent = "Logging out…";
    try { await onLogout(); }
    catch (error) {
      logoutButton.disabled = false;
      logoutButton.querySelector("strong").textContent = "Logout";
      onError(error?.message || "Logout failed");
    }
  });
  updateTheme();

  return {
    setIdentity(identity = {}) {
      const name = identity.displayName || identity.email || "Platform administrator";
      const email = identity.email || identity.subject || "Identity unavailable";
      const role = identity.roles?.[0] || "unknown role";
      document.querySelector("#admin-name").textContent = name;
      document.querySelector("#admin-role").textContent = role;
      document.querySelector("#admin-menu-name").textContent = name;
      document.querySelector("#admin-menu-email").textContent = email;
      document.querySelectorAll("[data-admin-avatar]").forEach((avatar) => { avatar.textContent = administratorInitials(identity); });
    }
  };
}
