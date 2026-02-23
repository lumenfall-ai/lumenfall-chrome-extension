/**
 * Content script injected into the active tab when dragging images from the
 * Lumenfall gallery.  Intercepts drop events and reconstructs a proper File
 * object from the data URL stored in chrome.storage.local so that file-upload
 * dropzones on the target page see the image as a real file.
 */
(() => {
  // Guard against double-injection
  if (window.__lumenfallDragHelper) return;
  window.__lumenfallDragHelper = true;

  let pendingImageDataUrl = null;

  function dataUrlToFile(dataUrl, filename) {
    const [header, b64] = dataUrl.split(",");
    const mime = header.match(/:(.*?);/)?.[1] || "image/png";
    const bytes = atob(b64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new File([arr], filename, { type: mime });
  }

  // Load the pending image immediately on injection (happens at dragstart)
  function loadPendingImage() {
    try {
      chrome.storage.local.get({ pendingDragImage: "" }, (data) => {
        pendingImageDataUrl = data.pendingDragImage || null;
      });
    } catch {
      // Extension context may be invalidated
    }
  }

  // Also watch for storage changes (in case load races with set)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.pendingDragImage) {
      pendingImageDataUrl = changes.pendingDragImage.newValue || null;
    }
  });

  loadPendingImage();

  // Handle dragover in capturing phase — call preventDefault() so the browser
  // dispatches the subsequent drop event.  Without this, pages that don't have
  // their own dragover handler would swallow the drop silently (per HTML DnD spec).
  document.addEventListener(
    "dragover",
    (e) => {
      if (!pendingImageDataUrl) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    },
    true // capturing phase
  );

  // Listen for drop events in the capturing phase so we run before the page's
  // own handler.  If we have a pending image, stop the original event and
  // re-dispatch a synthetic one that carries a proper File.
  document.addEventListener(
    "drop",
    (e) => {
      if (!pendingImageDataUrl) return;

      const dataUrl = pendingImageDataUrl;
      pendingImageDataUrl = null;

      // Clean up storage
      try { chrome.storage.local.remove("pendingDragImage"); } catch {}

      // Extract extension from MIME type (must be inline — content scripts can't share code with extension pages)
      const mimeMatch = dataUrl.match(/^data:(image\/\w+)/);
      const ext = mimeMatch?.[1] === "image/jpeg" ? "jpg"
        : mimeMatch?.[1] === "image/webp" ? "webp"
        : mimeMatch?.[1] === "image/gif" ? "gif"
        : mimeMatch?.[1] === "image/avif" ? "avif"
        : "png";
      const file = dataUrlToFile(dataUrl, `lumenfall-${Date.now()}.${ext}`);

      // Build a DataTransfer with the file
      const dt = new DataTransfer();
      dt.items.add(file);

      const syntheticDrop = new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt
      });

      // Prevent the original (empty) drop from being handled
      e.preventDefault();
      e.stopImmediatePropagation();

      // Dispatch on the same target so the page's drop handler picks it up
      e.target.dispatchEvent(syntheticDrop);
    },
    true // capturing phase
  );

  // Clean up when drag ends without a drop
  document.addEventListener("dragend", () => {
    pendingImageDataUrl = null;
    try { chrome.storage.local.remove("pendingDragImage"); } catch {}
  });
})();
