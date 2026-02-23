importScripts("src/permissions.js", "src/api.js", "src/storage.js");

function ensureContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "lumenfall-edit-image",
      title: "Edit with Lumenfall",
      contexts: ["image"]
    });
  });
}

async function ensureSidePanel() {
  if (!chrome.sidePanel) return;
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    await chrome.sidePanel.setOptions({ path: "popup.html", enabled: true });
  } catch (_) {}
}

chrome.runtime.onInstalled.addListener(async () => {
  await migrateStorage();
  ensureContextMenu();
  ensureSidePanel();
});

chrome.runtime.onStartup.addListener(() => {
  ensureContextMenu();
  ensureSidePanel();
});

/* ---------- Drag-and-drop relay ----------
 * Chrome doesn't transfer dataTransfer.files from the extension side-panel to
 * web pages.  We bridge this by:
 *   1. Side panel sends image data here on dragstart.
 *   2. We inject content-drop.js into the active tab (captures drop events).
 *   3. The content script requests the image data back from us and creates a
 *      real File in the page context.
 */
let pendingDragData = null;

async function injectDropHandler(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["src/content-drop.js"],
    });
  } catch (err) {
    console.warn("[drag] inject failed (host permission?):", err.message);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "lumenfall-drag-start") {
    pendingDragData = {
      imageDataUrl: message.imageDataUrl,
      filename: message.filename,
    };
    // Inject the drop handler into the active tab (best-effort)
    chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(([tab]) => tab && injectDropHandler(tab.id));
    return;
  }

  if (message.type === "lumenfall-get-drag-data") {
    console.log("[drag] content script requested drag data, available:", !!pendingDragData);
    sendResponse(pendingDragData);
    pendingDragData = null;
    return true; // keep channel open for sendResponse
  }

  if (message.type === "lumenfall-inject-drop-handler") {
    chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(([tab]) => tab && injectDropHandler(tab.id));
    return;
  }
});

/* ---------- Context menu ---------- */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "lumenfall-edit-image") return;
  const imageUrl = info.srcUrl;
  if (!imageUrl) return;

  // Open the panel synchronously — must happen in the user gesture context.
  if (chrome.sidePanel) {
    chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {
      chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
    });
  } else {
    chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
  }

  // Request host permission directly — call request() as the FIRST await so
  // the user-gesture context from the context-menu click is still alive.
  // (ensureHostAccess() breaks this because its contains() pre-check is the
  // first await, consuming the gesture before request() runs.)
  // request() resolves to true silently if permission is already granted.
  try {
    const { protocol, host } = new URL(imageUrl);
    await chrome.permissions.request({ origins: [`${protocol}//${host}/*`] });
  } catch (_) {}

  chrome.storage.local.set({ pendingEditImage: imageUrl });
});
