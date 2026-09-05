function isIpAddress(hostname) {
  if (hostname.includes(":")) return true;
  const parts = hostname.split(".");
  return parts.length === 4
    && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

/**
 * Validate the public HTTPS endpoint shape accepted by the admin BFF.
 * DNS resolution and egress enforcement remain server-side responsibilities.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidPublicHttpsUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    return value.length <= 2048
      && url.protocol === "https:"
      && Boolean(hostname)
      && !url.username
      && !url.password
      && !url.search
      && !url.hash
      && !isIpAddress(hostname)
      && !/^localhost$/i.test(hostname)
      && !/\.localhost$/i.test(hostname)
      && !/\.local$/i.test(hostname);
  } catch {
    return false;
  }
}
