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
  if (blobCache.has(imageUrl)) return;
  try {
    if (imageUrl.startsWith("data:")) {
      blobCache.set(imageUrl, dataUrlToBlob(imageUrl));
    } else {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      blobCache.set(imageUrl, blob);
    }
  } catch (_) {
    // Non-fatal — drag will still carry URL fallbacks
  }
}

function setupDragSource(element, item, card) {
  element.draggable = true;

  // Prefetch immediately so the blob is ready for dragstart
  prefetchBlob(item.url);

  // Safety net: also prefetch on hover in case the image wasn't cached yet
  element.addEventListener("mouseenter", () => prefetchBlob(item.url));

  element.addEventListener("dragstart", (e) => {
    card.classList.add("dragging");

    // Attach a real File so drop targets that expect dataTransfer.files work.
    // This is indistinguishable from a file dragged from the OS file explorer.
    const blob = blobCache.get(item.url);
    if (blob) {
      const file = new File([blob], lumenfallFilename(item.url), { type: blob.type || "image/png" });
      try {
        e.dataTransfer.items.add(file);
      } catch (_) {
        // Fallback: some browsers don't support items.add(File)
      }
    }

    // Set URL fallbacks for targets that accept URLs (e.g. WYSIWYG editors)
    if (item.url.startsWith("data:")) {
      const urlBlob = blob || dataUrlToBlob(item.url);
      const blobUrl = URL.createObjectURL(urlBlob);
      e.dataTransfer.setData("text/uri-list", blobUrl);
      e.dataTransfer.setData("text/plain", blobUrl);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } else {
      e.dataTransfer.setData("text/uri-list", item.url);
      e.dataTransfer.setData("text/plain", item.url);
    }

    e.dataTransfer.effectAllowed = "copy";
  });

  element.addEventListener("dragend", () => {
    card.classList.remove("dragging");
  });
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
