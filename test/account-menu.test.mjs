import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { administratorInitials, parseThemePreference, resolveThemePreference } from "../public/account-menu.js";

const root = new URL("../", import.meta.url);
const [html, source, styles, mockStore] = await Promise.all([
  readFile(new URL("public/index.html", root), "utf8"),
  readFile(new URL("public/account-menu.js", root), "utf8"),
  readFile(new URL("public/styles.css", root), "utf8"),
  readFile(new URL("lib/mock-admin-store.mjs", root), "utf8")
]);

test("matches the management-console account menu without inventing account settings", () => {
  assert.match(html, /id="admin-account-trigger"[^>]+aria-controls="admin-account-menu"[^>]+aria-expanded="false"/);
  assert.match(html, /id="admin-account-menu"[^>]+aria-label="Account" hidden/);
  assert.match(html, /id="theme-menu-trigger"[^>]+aria-haspopup="menu"[^>]+aria-controls="theme-menu"/);
  assert.equal((html.match(/role="menuitemradio"/g) || []).length, 3);
  assert.match(html, /data-theme-preference="system"/);
  assert.match(html, /data-theme-preference="light"/);
  assert.match(html, /data-theme-preference="dark"/);
  assert.match(html, /id="admin-logout"/);
  assert.doesNotMatch(`${html}\n${source}`, /Account Settings|account settings|password/i);
  assert.match(mockStore, /actor: \{ issuer: "https:\/\/idp\.example\.test\/realms\/acornops"/);
  assert.match(mockStore, /displayName: "Local Platform Admin"/);
});

test("resolves and persists the same three appearance preferences", () => {
  assert.equal(parseThemePreference("system"), "system");
  assert.equal(parseThemePreference("light"), "light");
  assert.equal(parseThemePreference("dark"), "dark");
  assert.equal(parseThemePreference("unknown"), "system");
  assert.equal(resolveThemePreference("system", true), "dark");
  assert.equal(resolveThemePreference("system", false), "light");
  assert.equal(resolveThemePreference("light", true), "light");
  assert.equal(resolveThemePreference("dark", false), "dark");
  assert.match(source, /localStorage\.setItem\(THEME_STORAGE_KEY, preference\)/);
  assert.match(source, /mediaQuery\.addEventListener\("change"/);
  assert.match(styles, /html\[data-resolved-theme="dark"\]/);
});

test("derives compact administrator initials from the projected human identity", () => {
  assert.equal(administratorInitials({ displayName: "Avery Admin" }), "AA");
  assert.equal(administratorInitials({ email: "avery@example.test" }), "AE");
  assert.equal(administratorInitials({ subject: "platform-admin-42" }), "PA");
});
