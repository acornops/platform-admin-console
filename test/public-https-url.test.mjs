import assert from "node:assert/strict";
import test from "node:test";

import { isValidPublicHttpsUrl } from "../lib/public-https-url.mjs";

test("public HTTPS endpoint validation is shared by browser and BFF", () => {
  for (const endpoint of [
    "https://mcp.example.com",
    "https://mcp.example.com/service/path"
  ]) {
    assert.equal(isValidPublicHttpsUrl(endpoint), true, endpoint);
  }

  for (const endpoint of [
    "",
    "http://mcp.example.com",
    "https://localhost/mcp",
    "https://service.local/mcp",
    "https://127.0.0.1/mcp",
    "https://2130706433/mcp",
    "https://[::1]/mcp",
    "https://user:password@mcp.example.com/mcp",
    "https://mcp.example.com/mcp?token=secret",
    "https://mcp.example.com/mcp#fragment",
    `https://mcp.example.com/${"a".repeat(2048)}`
  ]) {
    assert.equal(isValidPublicHttpsUrl(endpoint), false, endpoint);
  }
});
