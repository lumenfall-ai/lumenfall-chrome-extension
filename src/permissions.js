/**
 * Runtime host-permission helper.
 *
 * `https://*/*` lives in optional_host_permissions so the extension installs
 * without the scary "read and change all your data on all websites" warning.
 * We request access on demand when the user initiates an action that needs it.
 */

/**
 * Ensure we have host permission for the given URL's origin.
 * Must be called from a user-gesture context (click, drop, etc.).
 *
 * @param {string} url – The URL we need to fetch.
 * @returns {Promise<boolean>} true if permission is available (or was just granted).
 */
async function ensureHostAccess(url) {
  // data: and blob: URLs don't require host permissions
  if (!url || url.startsWith("data:") || url.startsWith("blob:")) return true;

  // chrome-extension: URLs are always accessible
  if (url.startsWith("chrome-extension:")) return true;

  let origin;
  try {
    const parsed = new URL(url);
    origin = `${parsed.protocol}//${parsed.host}/*`;
  } catch {
    return false;
  }

  // Already granted?
  const has = await chrome.permissions.contains({ origins: [origin] });
  if (has) return true;

  // Request – Chrome shows a prompt to the user
  try {
    return await chrome.permissions.request({ origins: [origin] });
  } catch {
    return false;
  }
}
