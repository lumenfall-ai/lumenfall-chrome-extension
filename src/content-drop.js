/**
 * Lightweight content script injected into the active tab to handle drops
 * from the Lumenfall side panel.
 *
 * Chrome does not transfer dataTransfer.files across the extension side-panel
 * → web-page boundary (only string types survive). This script bridges the
 * gap: it intercepts the drop in the page context, fetches the actual image
 * data from the extension background, builds a real File, and dispatches a
 * synthetic drop event the page's upload handler can process.
 */
(function () {
  if (window.__lumenfallDropHandler) return;
  window.__lumenfallDropHandler = true;

  const MARKER = "text/x-lumenfall-image";

  function dataUrlToBlob(dataUrl) {
    const [header, b64] = dataUrl.split(",");
    const mime = header.match(/:(.*?);/)?.[1] || "image/png";
    const bytes = atob(b64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  function isLumenfallDrag(e) {
    return e.dataTransfer.types.includes(MARKER);
  }

  // --- Capture-phase handlers so we act before the page's own listeners ---

  document.addEventListener(
    "dragenter",
    (e) => {
      if (!isLumenfallDrag(e)) return;
      e.preventDefault();
    },
    true
  );

  document.addEventListener(
    "dragover",
    (e) => {
      if (!isLumenfallDrag(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    },
    true
  );

  document.addEventListener(
    "drop",
    async (e) => {
      if (!isLumenfallDrag(e)) return;

      e.preventDefault();
      e.stopImmediatePropagation();

      const dropTarget = e.target;
      console.log("[lumenfall-drop] intercepted on", dropTarget);

      let response;
      try {
        response = await chrome.runtime.sendMessage({
          type: "lumenfall-get-drag-data",
        });
      } catch (err) {
        console.error("[lumenfall-drop] messaging failed:", err);
        return;
      }

      if (!response?.imageDataUrl) {
        console.error("[lumenfall-drop] no image data from background");
        return;
      }

      // Build a File in the page's JS context
      let blob;
      if (response.imageDataUrl.startsWith("data:")) {
        blob = dataUrlToBlob(response.imageDataUrl);
      } else {
        try {
          const res = await fetch(response.imageDataUrl);
          blob = await res.blob();
        } catch (err) {
          console.error("[lumenfall-drop] fetch failed:", err);
          return;
        }
      }

      const file = new File([blob], response.filename, {
        type: blob.type || "image/png",
      });
      console.log(
        "[lumenfall-drop] created File:",
        file.name,
        file.type,
        file.size,
        "bytes"
      );

      // Build a pristine DataTransfer containing only our File
      const dt = new DataTransfer();
      dt.items.add(file);

      const synthetic = new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt,
      });

      console.log("[lumenfall-drop] dispatching synthetic drop");
      dropTarget.dispatchEvent(synthetic);

      // Fallback: some sites listen on a hidden <input type="file"> instead
      // of drop events.  Try to populate the nearest file input.
      const zone =
        dropTarget.closest("[class*=drop], [class*=upload], [class*=zone]") ||
        dropTarget.parentElement;
      if (zone) {
        const input = zone.querySelector('input[type="file"]');
        if (input) {
          const inputDt = new DataTransfer();
          inputDt.items.add(file);
          input.files = inputDt.files;
          input.dispatchEvent(new Event("change", { bubbles: true }));
          console.log("[lumenfall-drop] also set file on", input);
        }
      }
    },
    true
  );

  console.log("[lumenfall-drop] handler installed");
})();
