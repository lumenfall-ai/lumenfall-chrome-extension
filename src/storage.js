const GALLERY_MAX = 30;

const LOCAL_DEFAULTS = {
  apiKey: "",
  baseUrl: DEFAULT_BASE_URL,
  gallery: [],
  storedModels: []
};

const SYNC_DEFAULTS = {
  lastModel: "",
  lastRatio: "1:1",
  brainstormModel: "",
  fastImageModel: "z-image-turbo",
  lastPrompt: "",
  theme: "auto",
  brainstormSystemPrompt: "",
  contextMenuTipDismissed: false,
  dataConsentGiven: false
};

function getLocal(keys) {
  const defaults = {};
  for (const key of keys) {
    if (key in LOCAL_DEFAULTS) defaults[key] = LOCAL_DEFAULTS[key];
  }
  return new Promise((resolve) => {
    chrome.storage.local.get(defaults, resolve);
  });
}

function setLocal(obj) {
  return new Promise((resolve) => {
    chrome.storage.local.set(obj, resolve);
  });
}

function getSync(keys) {
  const defaults = {};
  for (const key of keys) {
    if (key in SYNC_DEFAULTS) defaults[key] = SYNC_DEFAULTS[key];
  }
  return new Promise((resolve) => {
    chrome.storage.sync.get(defaults, resolve);
  });
}

function setSync(obj) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(obj, resolve);
  });
}

async function getGallery() {
  const { gallery } = await getLocal(["gallery"]);
  return Array.isArray(gallery) ? gallery : [];
}

async function addGalleryItem(item) {
  const gallery = await getGallery();
  gallery.unshift(item);
  if (gallery.length > GALLERY_MAX) gallery.length = GALLERY_MAX;
  await setLocal({ gallery });
}

async function removeGalleryItem(timestamp) {
  let gallery = await getGallery();
  gallery = gallery.filter((item) => item.timestamp !== timestamp);
  await setLocal({ gallery });
}

async function clearGallery() {
  await setLocal({ gallery: [] });
}

async function migrateStorage() {
  const syncData = await new Promise((resolve) => {
    chrome.storage.sync.get(
      { apiKey: "", baseUrl: "", storedResults: [], storedModels: [] },
      resolve
    );
  });

  if (!syncData.apiKey && !syncData.storedResults?.length && !syncData.storedModels?.length) {
    return;
  }

  const localUpdate = {};
  const syncRemoveKeys = [];

  if (syncData.apiKey) {
    localUpdate.apiKey = syncData.apiKey;
    syncRemoveKeys.push("apiKey");
  }
  if (syncData.baseUrl) {
    localUpdate.baseUrl = syncData.baseUrl;
    syncRemoveKeys.push("baseUrl");
  }
  if (Array.isArray(syncData.storedModels) && syncData.storedModels.length) {
    localUpdate.storedModels = syncData.storedModels;
    syncRemoveKeys.push("storedModels");
  }
  if (Array.isArray(syncData.storedResults) && syncData.storedResults.length) {
    localUpdate.gallery = syncData.storedResults.map((url) => ({
      url,
      prompt: "",
      model: "",
      aspect_ratio: "",
      timestamp: Date.now()
    }));
    syncRemoveKeys.push("storedResults");
  }

  if (Object.keys(localUpdate).length) {
    await setLocal(localUpdate);
  }
  if (syncRemoveKeys.length) {
    await new Promise((resolve) => {
      chrome.storage.sync.remove(syncRemoveKeys, resolve);
    });
  }
}
