const MAX_TEXT_LENGTH = 6000;

function getPageText() {
  const title = document.title ? `Title: ${document.title}\n\n` : "";
  const bodyText = document.body?.innerText || "";
  const text = `${title}${bodyText}`.trim();
  return text.slice(0, MAX_TEXT_LENGTH);
}

function createDraggableImage(url) {
  const existingHost = document.getElementById("lumenfall-draggable-host");
  if (existingHost) existingHost.remove();

  const host = document.createElement("div");
  host.id = "lumenfall-draggable-host";
  host.style.cssText = "all:initial; position:fixed; top:0; left:0; width:0; height:0; z-index:2147483647;";
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "closed" });

  const style = document.createElement("style");
  style.textContent = `
    .container {
      position: fixed;
      top: 80px;
      right: 24px;
      z-index: 2147483647;
      background: rgba(15, 17, 21, 0.92);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      cursor: grab;
      font-family: system-ui, sans-serif;
      font-size: 13px;
      color: #e0e0e0;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    }
    .container.dragging { cursor: grabbing; }
    img {
      max-width: 240px;
      border-radius: 8px;
      display: block;
    }
    .controls {
      display: flex;
      gap: 8px;
    }
    button {
      border: none;
      border-radius: 8px;
      padding: 6px 10px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      font-family: inherit;
    }
    .pin {
      background: oklch(93% 0.147 126);
      color: #1a1d24;
    }
    .close {
      background: transparent;
      color: #e0e0e0;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
  `;

  const container = document.createElement("div");
  container.className = "container";

  const img = document.createElement("img");
  img.src = url;
  img.alt = "Lumenfall generated";

  const controls = document.createElement("div");
  controls.className = "controls";

  const pinButton = document.createElement("button");
  pinButton.textContent = "Pin to page";
  pinButton.className = "pin";

  const closeButton = document.createElement("button");
  closeButton.textContent = "Close";
  closeButton.className = "close";

  controls.append(pinButton, closeButton);
  container.append(img, controls);
  shadow.append(style, container);

  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  function onMouseDown(e) {
    if (e.target === pinButton || e.target === closeButton) return;
    isDragging = true;
    offsetX = e.clientX - container.getBoundingClientRect().left;
    offsetY = e.clientY - container.getBoundingClientRect().top;
    container.classList.add("dragging");
  }

  function onMouseMove(e) {
    if (!isDragging) return;
    container.style.left = `${e.clientX - offsetX}px`;
    container.style.top = `${e.clientY - offsetY}px`;
    container.style.right = "auto";
  }

  function onMouseUp() {
    if (!isDragging) return;
    isDragging = false;
    container.classList.remove("dragging");
  }

  function cleanup() {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    host.remove();
  }

  container.addEventListener("mousedown", onMouseDown);
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);

  pinButton.addEventListener("click", () => {
    const rect = container.getBoundingClientRect();
    const pinned = document.createElement("img");
    pinned.src = url;
    pinned.alt = "Lumenfall generated";
    pinned.style.cssText = `
      position: absolute;
      left: ${rect.left + window.scrollX}px;
      top: ${rect.top + window.scrollY}px;
      max-width: 240px;
      z-index: 999998;
      border-radius: 8px;
    `;
    document.body.appendChild(pinned);
    cleanup();
  });

  closeButton.addEventListener("click", cleanup);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "getPageText") {
    sendResponse({ text: getPageText() });
    return true;
  }

  if (message.type === "insertDraggableImage") {
    createDraggableImage(message.url);
  }
});
