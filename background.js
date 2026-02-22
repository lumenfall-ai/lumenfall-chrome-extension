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
