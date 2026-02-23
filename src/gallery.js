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

/* --- Blob cache for drag-and-drop ---
 * dataTransfer is only writable during the synchronous dragstart handler.
 * Blobs MUST be ready in memory before the user starts dragging — any async
 * work (fetch, etc.) after dragstart is too late.
 * See: https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/Drag_data_store
 */
const blobCache = new Map();

async function prefetchBlob(imageUrl) {
  if (blobCache.has(imageUrl)) {
    console.log("[drag] prefetchBlob: cache hit", imageUrl.slice(0, 80));
    return;
  }
  try {
    let blob;
    if (imageUrl.startsWith("data:")) {
      blob = dataUrlToBlob(imageUrl);
      console.log("[drag] prefetchBlob: converted data URL →", blob.type, blob.size, "bytes");
    } else {
      const res = await fetch(imageUrl);
      blob = await res.blob();
      console.log("[drag] prefetchBlob: fetched remote →", blob.type, blob.size, "bytes", imageUrl.slice(0, 80));
    }
    blobCache.set(imageUrl, blob);
  } catch (err) {
    console.error("[drag] prefetchBlob: FAILED for", imageUrl.slice(0, 80), err);
  }
}

function setupDragSource(element, item, card) {
  element.draggable = true;

  // Prefetch blob so it's ready for dragstart
  prefetchBlob(item.url);
  element.addEventListener("mouseenter", () => prefetchBlob(item.url));

  element.addEventListener("dragstart", (e) => {
    card.classList.add("dragging");

    // Clear Chrome's auto-populated items (native file, text/html, text/uri-list)
    // so we have full control over what's in the dataTransfer.
    e.dataTransfer.items.clear();

    // --- Content-script bridge ---
    // Chrome doesn't transfer dataTransfer.files across the extension → page
    // boundary.  Send the image data to the background script so our content
    // script (content-drop.js) can reconstruct a real File in the page context.
    const filename = lumenfallFilename(item.url);
    chrome.runtime.sendMessage({
      type: "lumenfall-drag-start",
      imageDataUrl: item.url,
      filename,
    });

    // Marker type so content-drop.js can identify our drag during dragover
    e.dataTransfer.setData("text/x-lumenfall-image", "1");

    // Best-effort: also attach a File directly (works if the drop target is
    // within the extension, and might work on some browsers/targets).
    const blob = blobCache.get(item.url);
    if (blob) {
      const file = new File([blob], filename, { type: blob.type || "image/png" });
      try { e.dataTransfer.items.add(file); } catch (_) {}
    }

    // For remote URLs, provide a fetchable URL for targets that prefer URLs
    if (!item.url.startsWith("data:")) {
      e.dataTransfer.setData("text/uri-list", item.url);
      e.dataTransfer.setData("text/plain", item.url);
    }

    e.dataTransfer.effectAllowed = "copy";

    console.log("[drag] dragstart: types:", [...e.dataTransfer.types],
      "items:", e.dataTransfer.items.length,
      "sent to background for content-script relay");
  });

  element.addEventListener("dragend", () => {
    card.classList.remove("dragging");
  });
}

function renderGallery(items) {
  const grid = document.getElementById("galleryGrid");
  const empty = document.getElementById("galleryEmpty");
  if (!grid || !empty) return;

  // Pre-inject the drop handler into the active tab so it's ready before
  // the user starts dragging.  Silently ignored if host permission is missing.
  if (items.length) {
    chrome.runtime.sendMessage({ type: "lumenfall-inject-drop-handler" });
  }

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
