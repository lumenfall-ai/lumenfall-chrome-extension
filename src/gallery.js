async function refreshGallery() {
  const gallery = await getGallery();
  renderGallery(gallery);
}

function dataUrlToBlob(dataUrl) {
  const [header, b64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "image/png";
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// Smallest valid 1x1 transparent PNG (~67 bytes). Used as a dummy File in
// dataTransfer so that dataTransfer.types includes "Files" — many dropzone
// libraries check for this during dragover to decide whether to accept a drag.
const _PIXEL_PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAABJRUEFTkSuQmCC"), c => c.charCodeAt(0));

let _lastDragInjectionFailed = false;
let _onDragPermissionNeeded = null;

function setupDragSource(element, item, card) {
  element.draggable = true;
  element.addEventListener("dragstart", (e) => {
    card.classList.add("dragging");
    _lastDragInjectionFailed = false;

    if (item.url.startsWith("data:")) {
      // Add a tiny dummy file so dataTransfer.types includes "Files" —
      // many dropzone libraries check this during dragover to accept the drag.
      // The real image is delivered by the content script on drop.
      // Using a 1x1 transparent PNG (~67 bytes) avoids the data-URL redirect
      // issue that occurred with the full image.
      try {
        const dummy = new File([_PIXEL_PNG], lumenfallFilename(item.url), { type: "image/png" });
        e.dataTransfer.items.add(dummy);
      } catch (_) {}
      e.dataTransfer.setData("text/plain", lumenfallFilename(item.url));
    } else {
      e.dataTransfer.setData("text/uri-list", item.url);
      e.dataTransfer.setData("text/plain", item.url);
    }
    e.dataTransfer.effectAllowed = "copyMove";

    // Store the image in chrome.storage and inject a content script into the
    // active tab.  The content script intercepts the drop event on the target
    // page and reconstructs a proper File object so file-upload dropzones work.
    const dataUrl = item.url.startsWith("data:") ? item.url : null;
    if (dataUrl) {
      chrome.storage.local.set({ pendingDragImage: dataUrl });
      injectDragDropHelper().then((ok) => {
        if (!ok) _lastDragInjectionFailed = true;
      });
    }
  });
  element.addEventListener("dragend", () => {
    card.classList.remove("dragging");
    chrome.storage.local.remove("pendingDragImage");
    if (_lastDragInjectionFailed) {
      _lastDragInjectionFailed = false;
      if (_onDragPermissionNeeded) _onDragPermissionNeeded();
    }
  });
}

async function injectDragDropHelper() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id || !tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) return false;
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ["src/drag-drop-helper.js"]
    });
    return true;
  } catch (_) {
    // Injection may fail on restricted pages or when host permission is missing
    return false;
  }
}

const _restrictedPrefixes = ["chrome://", "chrome-extension://", "about:", "edge://", "brave://"];

async function checkDragPermission() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id || !tab.url) return { allowed: false, restricted: true };

    if (_restrictedPrefixes.some((p) => tab.url.startsWith(p))) {
      return { allowed: false, restricted: true };
    }

    const { protocol, host } = new URL(tab.url);
    const origin = `${protocol}//${host}/*`;

    const has = await chrome.permissions.contains({ origins: [origin] });
    if (has) return { allowed: true, tab, origin, hostname: host };

    return { allowed: false, restricted: false, origin, hostname: host, tab };
  } catch {
    return { allowed: false, restricted: true };
  }
}

async function requestDragPermission(origin) {
  try {
    const granted = await chrome.permissions.request({ origins: [origin] });
    if (granted) await injectDragDropHelper();
    return granted;
  } catch {
    return false;
  }
}

function renderGallery(items) {
  const grid = document.getElementById("galleryGrid");
  const empty = document.getElementById("galleryEmpty");
  if (!grid || !empty) return;

  grid.innerHTML = "";

  if (!items.length) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  items.forEach((item) => {
    const el = document.createElement("div");
    el.className = "gallery-item";

    const imgWrap = document.createElement("div");
    imgWrap.className = "gallery-thumb";

    const img = document.createElement("img");
    img.alt = item.prompt || "Generated image";
    img.src = item.url;
    img.loading = "lazy";
    // Enable drag — sets a blob URL so sites that accept URL drops (e.g. Google Image Search) can use it
    setupDragSource(img, item, el);

    imgWrap.appendChild(img);

    // Expand button (opens full image in new tab)
    const expandBtn = document.createElement("button");
    expandBtn.className = "gallery-expand";
    expandBtn.title = "Open full size";
    expandBtn.innerHTML = "&#x2922;"; // ⤢ north east and south west arrow
    expandBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (item.url.startsWith("data:")) {
        const blob = dataUrlToBlob(item.url);
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, "_blank");
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      } else {
        window.open(item.url, "_blank");
      }
    });
    imgWrap.appendChild(expandBtn);

    // Drag bar — visual affordance for dragging
    const dragBar = document.createElement("div");
    dragBar.className = "gallery-drag-bar";
    dragBar.title = "Drag image to another app or page";
    dragBar.innerHTML = '<span class="gallery-grip-icon">⠿</span> Drag';
    setupDragSource(dragBar, item, el);
    imgWrap.appendChild(dragBar);

    el.appendChild(imgWrap);

    const meta = document.createElement("div");
    meta.className = "gallery-meta";

    if (item.prompt) {
      const promptEl = document.createElement("div");
      promptEl.className = "gallery-meta-prompt";
      promptEl.textContent = item.prompt;
      promptEl.title = item.prompt;
      meta.appendChild(promptEl);
    }

    const modelName = item.model ? item.model.split("/").pop() : "";
    const durationStr = item.duration_ms ? `${(item.duration_ms / 1000).toFixed(1)}s` : "";
    const metaLine = [modelName, durationStr].filter(Boolean).join(" \u00b7 ");
    if (metaLine) {
      const infoEl = document.createElement("div");
      infoEl.className = "gallery-meta-info";
      infoEl.textContent = metaLine;
      meta.appendChild(infoEl);
    }

    el.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "gallery-actions";

    const copyImg = document.createElement("button");
    copyImg.textContent = "Copy";
    copyImg.className = "secondary";
    copyImg.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        let blob;
        if (item.url.startsWith("data:")) {
          blob = dataUrlToBlob(item.url);
        } else {
          await ensureHostAccess(item.url);
          blob = await fetch(item.url).then((r) => r.blob());
        }
        await navigator.clipboard.write([new ClipboardItem({ [blob.type || "image/png"]: blob })]);
      } catch (_) {
        navigator.clipboard.writeText(item.url);
      }
    });

    const download = document.createElement("button");
    download.textContent = "Download";
    download.className = "secondary";
    download.addEventListener("click", (e) => {
      e.stopPropagation();
      try {
        let blobUrl;
        if (item.url.startsWith("data:")) {
          const blob = dataUrlToBlob(item.url);
          blobUrl = URL.createObjectURL(blob);
        } else {
          blobUrl = item.url;
        }
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = lumenfallFilename(item.url);
        a.click();
        if (blobUrl !== item.url) {
          setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        }
      } catch (_) {
        window.open(item.url, "_blank");
      }
    });

    actions.append(copyImg, download);

    const del = document.createElement("button");
    del.textContent = "Delete";
    del.className = "secondary";
    del.addEventListener("click", async (e) => {
      e.stopPropagation();
      await removeGalleryItem(item.timestamp);
      refreshGallery();
    });
    actions.appendChild(del);

    el.appendChild(actions);
    grid.appendChild(el);
  });
}
