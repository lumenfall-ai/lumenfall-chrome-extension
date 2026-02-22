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

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "lumenfall-edit-image") return;
  const imageUrl = info.srcUrl;
  if (!imageUrl) return;

  // Fire storage write without awaiting — sidePanel.open() MUST be called
  // synchronously in the user gesture context or Chrome rejects it.
  chrome.storage.local.set({ pendingEditImage: imageUrl });

  if (chrome.sidePanel) {
    chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {
      chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
    });
    return;
  }
  chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
});
