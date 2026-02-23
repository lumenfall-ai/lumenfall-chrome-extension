/* --- DOM refs --- */

const apiKeyInput = document.getElementById("apiKey");
const baseUrlInput = document.getElementById("baseUrl");
const modelSelect = document.getElementById("modelSelect");
const ratioSelect = document.getElementById("ratioSelect");
const generateCountSelect = document.getElementById("generateCount");
const promptInput = document.getElementById("prompt");
const generateButton = document.getElementById("generateButton");
const generateStatus = document.getElementById("generateStatus");
const attachButton = document.getElementById("attachButton");
const ratioPickerBtn = document.getElementById("ratioPickerBtn");
const ratioDropdown = document.getElementById("ratioDropdown");
const ratioIcon = document.getElementById("ratioIcon");
const ratioLabelEl = document.getElementById("ratioLabel");
const costEstimate = document.getElementById("costEstimate");
const costValueEl = document.getElementById("costValue");
const brainstormButton = document.getElementById("brainstormButton");
const brainstormModelSelect = document.getElementById("brainstormModel");
const fastImageModelSelect = document.getElementById("fastImageModel");
const brainstormResults = document.getElementById("brainstormResults");
const brainstormStatus = document.getElementById("brainstormStatus");
const extractedTextContainer = document.getElementById("extractedText");
const extractedTextToggle = document.getElementById("extractedTextToggle");
const extractedTextBody = document.getElementById("extractedTextBody");
const brainstormSystemPromptInput = document.getElementById("brainstormSystemPrompt");
const resetBrainstormPromptButton = document.getElementById("resetBrainstormPrompt");
const settingsPanel = document.getElementById("settingsPanel");
const settingsButton = document.getElementById("settingsButton");
const closeSettingsButton = document.getElementById("closeSettings");
const saveSettingsButton = document.getElementById("saveSettings");
const reloadModelsButton = document.getElementById("reloadModels");
const restoreDefaultsButton = document.getElementById("restoreDefaults");
const settingsStatus = document.getElementById("settingsStatus");
const themeSelect = document.getElementById("themeSelect");
const onboarding = document.getElementById("onboarding");
const apiWarning = document.getElementById("apiWarning");
const brainstormWarning = document.getElementById("brainstormWarning");
const tabs = document.querySelectorAll(".tab");
const tabPanels = document.querySelectorAll(".tab-panel");
const generateContainer = document.getElementById("generateContainer");
const dragOverlay = document.getElementById("dragOverlay");
const filePreviewContainer = document.getElementById("filePreviewContainer");
const imageUpload = document.getElementById("imageUpload");
const contextMenuTip = document.getElementById("contextMenuTip");
const clearGalleryButton = document.getElementById("clearGallery");
const generateForm = document.getElementById("generateForm");
const generateOutput = document.getElementById("generateOutput");
const generateResults = document.getElementById("generateResults");
const generateInputStatus = document.getElementById("generateInputStatus");
const galleryBadge = document.getElementById("galleryBadge");
const balanceDisplay = document.getElementById("balanceDisplay");
const lowBalanceBanner = document.getElementById("lowBalanceBanner");
const modelSelectTrigger = document.getElementById("modelSelectTrigger");
const modelSelectThumb = document.getElementById("modelSelectThumb");
const modelSelectName = document.getElementById("modelSelectName");
const modelSelectorOverlay = document.getElementById("modelSelectorOverlay");
const modelSearchInput = document.getElementById("modelSearchInput");
const modelSelectorClose = document.getElementById("modelSelectorClose");
const modelSelectorList = document.getElementById("modelSelectorList");
const outputFormatSelect = document.getElementById("outputFormatSelect");
const resetFormButton = document.getElementById("resetFormButton");
const editModelWarning = document.getElementById("editModelWarning");
const dragPermissionBanner = document.getElementById("dragPermissionBanner");
const dragPermissionHost = document.getElementById("dragPermissionHost");
const dragPermissionHostBtn = document.getElementById("dragPermissionHostBtn");
const dragPermissionGrantSite = document.getElementById("dragPermissionGrantSite");
const dragPermissionGrantAll = document.getElementById("dragPermissionGrantAll");

/* --- State --- */

const FALLBACK_MODELS = window.LUMENFALL_MODELS;
const DEFAULT_BRAINSTORM_PROMPT =
  "You are an article illustrator. Given the text of an article, suggest 3 image prompts that would work as illustrations or header images for this content. Each prompt should be a detailed, visual description suitable for an AI image generator. Reply with a numbered list of prompts only, no commentary.";
const DEFAULT_FAST_IMAGE_MODEL = "z-image-turbo";
let imageModels = [];
let editModels = [];
let chatModels = [];
let allModels = []; // Full rich model list for the selector
let generationModels = []; // image + edit models for the selector
let pendingEditImages = [];
let _pendingDragOrigin = null;

/* --- Drag permission banner --- */

async function updateDragPermissionBanner() {
  const state = await checkDragPermission();
  if (state.allowed || state.restricted) {
    dragPermissionBanner.classList.add("hidden");
    _pendingDragOrigin = null;
    return;
  }
  _pendingDragOrigin = state.origin;
  dragPermissionHost.textContent = state.hostname;
  dragPermissionHostBtn.textContent = state.hostname;
  dragPermissionBanner.classList.remove("hidden");
}

dragPermissionGrantSite.addEventListener("click", async () => {
  if (!_pendingDragOrigin) return;
  await requestDragPermission(_pendingDragOrigin);
  updateDragPermissionBanner();
});

dragPermissionGrantAll.addEventListener("click", async () => {
  try {
    const granted = await chrome.permissions.request({ origins: ["https://*/*"] });
    if (granted) await injectDragDropHelper();
  } catch {}
  updateDragPermissionBanner();
});

chrome.tabs.onActivated.addListener(() => updateDragPermissionBanner());
chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.status === "complete") updateDragPermissionBanner();
});

/* --- Tabs --- */

function setTabs(activeTab) {
  tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === activeTab));
  tabPanels.forEach((panel) => panel.classList.toggle("active", panel.dataset.tabPanel === activeTab));
  if (activeTab === "gallery") {
    refreshGallery();
    hideGalleryBadge();
  }
  updateDragPermissionBanner();
}

tabs.forEach((tab) => tab.addEventListener("click", () => setTabs(tab.dataset.tab)));

/* --- Helpers --- */

function populateSelect(select, items) {
  select.innerHTML = "";
  items.forEach((model) => {
    const option = document.createElement("option");
    option.value = model.id;
    option.textContent = model.label || model.id;
    select.appendChild(option);
  });
}

function updateModelSelects() {
  generationModels = [...imageModels, ...editModels];
  populateSelect(modelSelect, generationModels);
  populateSelect(brainstormModelSelect, chatModels);
  populateSelect(fastImageModelSelect, imageModels);
  // Default to first featured model
  if (generationModels.length) {
    const defaultModel = generationModels.find((m) => m.featured) || generationModels[0];
    modelSelect.value = defaultModel.id;
    updateModelTrigger(defaultModel);
  } else {
    modelSelectThumb.innerHTML = "";
    modelSelectThumb.style.background = "var(--border)";
    modelSelectName.textContent = "Set up your API key to load models";
  }
  updateEditModelWarning();
}

/* --- Rich model selector --- */

function generateGradient(seed) {
  let hash = 0;
  for (const ch of String(seed || "")) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  const hue = Math.abs(hash) % 360;
  return `linear-gradient(135deg, hsl(${hue}, 55%, 60%), hsl(${(hue + 40) % 360}, 45%, 50%))`;
}

function updateModelTrigger(model) {
  modelSelectName.textContent = model.label || model.id;
  if (model.imageUrl) {
    modelSelectThumb.style.background = "";
    modelSelectThumb.innerHTML = "";
    const img = document.createElement("img");
    img.src = model.imageUrl;
    img.alt = "";
    img.onerror = () => { modelSelectThumb.innerHTML = ""; modelSelectThumb.style.background = generateGradient(model.creator || model.id); };
    modelSelectThumb.appendChild(img);
  } else {
    modelSelectThumb.innerHTML = "";
    modelSelectThumb.style.background = generateGradient(model.creator || model.id);
  }
}

function openModelSelector() {
  modelSelectorOverlay.classList.remove("hidden", "overlay-closing");
  modelSearchInput.value = "";
  modelSearchInput.focus();
  renderModelList(generationModels.length ? generationModels : allModels);
}

function closeModelSelector() {
  modelSelectorOverlay.classList.add("overlay-closing");
  const onEnd = () => {
    modelSelectorOverlay.removeEventListener("animationend", onEnd);
    modelSelectorOverlay.classList.add("hidden");
    modelSelectorOverlay.classList.remove("overlay-closing");
  };
  modelSelectorOverlay.addEventListener("animationend", onEnd);
}

let modelSearchTimer;
modelSearchInput.addEventListener("input", () => {
  clearTimeout(modelSearchTimer);
  modelSearchTimer = setTimeout(() => {
    const q = modelSearchInput.value.toLowerCase().trim();
    const source = generationModels.length ? generationModels : allModels;
    if (!q) return renderModelList(source);
    const filtered = source.filter((m) =>
      m.label.toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q) ||
      (m.description || "").toLowerCase().includes(q) ||
      (m.creator || "").toLowerCase().includes(q) ||
      (m.aliases || []).some((a) => a.toLowerCase().includes(q)) ||
      (m.alternativeNames || []).some((a) => a.toLowerCase().includes(q))
    );
    renderModelList(filtered);
  }, 150);
});

function renderModelList(models) {
  modelSelectorList.innerHTML = "";
  if (!models.length) {
    const empty = document.createElement("div");
    empty.className = "model-selector-empty";
    empty.textContent = "No models found.";
    modelSelectorList.appendChild(empty);
    return;
  }

  // Group: featured first, then all models by creator (featured appear in both)
  const featured = models.filter((m) => m.featured);
  const byCreator = {};
  models.forEach((m) => {
    const key = m.creator || "Other";
    (byCreator[key] = byCreator[key] || []).push(m);
  });

  if (featured.length) {
    appendGroupHeader("Featured");
    featured.forEach((m) => appendModelCard(m));
  }
  Object.keys(byCreator).sort().forEach((creator) => {
    appendGroupHeader(creator);
    byCreator[creator].forEach((m) => appendModelCard(m));
  });
}

function appendGroupHeader(text) {
  const header = document.createElement("div");
  header.className = "model-group-header";
  header.textContent = text;
  modelSelectorList.appendChild(header);
}

function appendModelCard(model) {
  const card = document.createElement("div");
  card.className = "model-card";
  if (model.id === modelSelect.value) card.classList.add("selected");

  // Thumbnail
  const thumb = document.createElement("div");
  thumb.className = "model-card-thumb";
  if (model.imageUrl) {
    const img = document.createElement("img");
    img.src = model.imageUrl;
    img.alt = "";
    img.loading = "lazy";
    img.onerror = () => { thumb.innerHTML = ""; thumb.style.background = generateGradient(model.creator || model.id); };
    thumb.appendChild(img);
  } else {
    thumb.style.background = generateGradient(model.creator || model.id);
  }
  card.appendChild(thumb);

  // Info
  const info = document.createElement("div");
  info.className = "model-card-info";

  const name = document.createElement("div");
  name.className = "model-card-name";
  name.textContent = model.label || model.id;
  info.appendChild(name);

  if (model.creator) {
    const creator = document.createElement("div");
    creator.className = "model-card-creator";
    creator.textContent = model.creator;
    info.appendChild(creator);
  }

  if (model.description) {
    const desc = document.createElement("div");
    desc.className = "model-card-desc";
    desc.textContent = model.description;
    info.appendChild(desc);
  }

  // Meta badges
  const meta = document.createElement("div");
  meta.className = "model-card-meta";

  const cats = model.categories || [model.category];
  if (cats.includes("image")) {
    const badge = document.createElement("span");
    badge.className = "model-badge model-badge-image";
    badge.textContent = "Image";
    meta.appendChild(badge);
  }
  if (cats.includes("edit")) {
    const badge = document.createElement("span");
    badge.className = "model-badge model-badge-edit";
    badge.textContent = "Edit";
    meta.appendChild(badge);
  }

  if (model.free) {
    const badge = document.createElement("span");
    badge.className = "model-badge model-badge-free";
    badge.textContent = "Free";
    meta.appendChild(badge);
  } else if (model.price != null) {
    const badge = document.createElement("span");
    badge.className = "model-badge model-badge-price";
    badge.textContent = model.price < 0.01 ? `$${model.price.toFixed(4)}` : `$${model.price.toFixed(2)}`;
    meta.appendChild(badge);
  }

  if (model.featured) {
    const badge = document.createElement("span");
    badge.className = "model-badge model-badge-featured";
    badge.textContent = "\u2605 Featured";
    meta.appendChild(badge);
  }

  if (model.status && model.status !== "active") {
    const badge = document.createElement("span");
    badge.className = "model-badge model-badge-status";
    badge.textContent = model.status.charAt(0).toUpperCase() + model.status.slice(1);
    meta.appendChild(badge);
  }

  if (meta.children.length) info.appendChild(meta);
  card.appendChild(info);

  // External link icon
  if (model.modelPagePath) {
    const link = document.createElement("button");
    link.className = "model-card-link";
    link.type = "button";
    link.title = "View on lumenfall.ai";
    link.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
    link.addEventListener("click", (e) => {
      e.stopPropagation();
      window.open(`https://lumenfall.ai${model.modelPagePath}`, "_blank");
    });
    card.appendChild(link);
  }

  // Click to select model
  card.addEventListener("click", () => selectModel(model));
  modelSelectorList.appendChild(card);
}

function selectModel(model) {
  modelSelect.value = model.id;
  updateModelTrigger(model);
  closeModelSelector();
  setSync({ lastModel: model.id });
  debouncedCostEstimate();
  updateEditModelWarning();
}

modelSelectTrigger.addEventListener("click", () => openModelSelector());
modelSelectorClose.addEventListener("click", () => closeModelSelector());
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modelSelectorOverlay.classList.contains("hidden")) {
    closeModelSelector();
  }
});

/* --- Edit model warning --- */

function updateEditModelWarning() {
  const model = generationModels.find((m) => m.id === modelSelect.value);
  const cats = model?.categories || [model?.category].filter(Boolean);
  const supportsEdit = cats.includes("edit");
  const hasImages = pendingEditImages.length > 0;
  // Warn when images attached (edit intent) but model doesn't support editing
  editModelWarning.classList.toggle("hidden", !hasImages || supportsEdit);
}

/* --- Reset form --- */

resetFormButton.addEventListener("click", resetGenerateForm);

function resetGenerateForm() {
  promptInput.value = "";
  autoGrowTextarea(false);
  pendingEditImages = [];
  setDropzoneState("");
  updateRatioDisplay("1:1");
  generateCountSelect.value = "1";
  outputFormatSelect.value = "";
  costEstimate.classList.add("hidden");
  generateInputStatus.textContent = "";
  promptInput.classList.remove("field-error");
  editModelWarning.classList.add("hidden");
  setSync({ lastPrompt: "" });
}

function showWarning(message, container) {
  container.textContent = message;
  container.classList.remove("hidden");
}

function hideWarning(container) {
  container.textContent = "";
  container.classList.add("hidden");
}

function apiKeyMissingMessage() {
  return "Add your Lumenfall API key in Settings. Visit lumenfall.ai to create an account and generate a key.";
}

function requireApiKey(container) {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    showWarning(apiKeyMissingMessage(), container);
    toggleSettingsVisibility(true);
    return null;
  }
  hideWarning(container);
  return apiKey;
}

function toggleSettingsVisibility(show) {
  const isHidden = settingsPanel.classList.contains("hidden");
  if (show) {
    settingsPanel.classList.remove("hidden", "settings-collapsing");
    onboarding.classList.toggle("hidden", false);
  } else {
    onboarding.classList.toggle("hidden", true);
    if (isHidden) return; // already hidden, nothing to animate
    settingsPanel.classList.add("settings-collapsing");
    const onEnd = () => {
      settingsPanel.removeEventListener("animationend", onEnd);
      settingsPanel.classList.add("hidden");
      settingsPanel.classList.remove("settings-collapsing");
    };
    settingsPanel.addEventListener("animationend", onEnd);
  }
}

function updateFeatureAvailability() {
  const hasKey = Boolean(apiKeyInput.value.trim());
  generateButton.disabled = !hasKey;
  brainstormButton.disabled = !hasKey;
  if (!hasKey) {
    showWarning(apiKeyMissingMessage(), apiWarning);
    showWarning(apiKeyMissingMessage(), brainstormWarning);
  } else {
    hideWarning(apiWarning);
    hideWarning(brainstormWarning);
  }
}

/* --- Ratio picker --- */

const RATIO_ICON_MAP = {
  "1:1": "ratio-icon-1x1",
  "16:9": "ratio-icon-16x9",
  "9:16": "ratio-icon-9x16",
  "4:3": "ratio-icon-4x3",
  "3:4": "ratio-icon-3x4",
  "21:9": "ratio-icon-21x9"
};

function updateRatioDisplay(ratio) {
  const cls = RATIO_ICON_MAP[ratio] || "ratio-icon-1x1";
  ratioIcon.className = "ratio-icon " + cls;
  ratioLabelEl.textContent = ratio;
  // Update hidden select for JS references
  ratioSelect.value = ratio;
  // Highlight active option in dropdown
  ratioDropdown.querySelectorAll(".ratio-option").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.ratio === ratio);
  });
}

ratioPickerBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const wasHidden = ratioDropdown.classList.contains("hidden");
  ratioDropdown.classList.toggle("hidden");
  if (wasHidden) {
    const rect = ratioPickerBtn.getBoundingClientRect();
    ratioDropdown.style.left = `${Math.max(8, rect.left + rect.width / 2 - 96)}px`;
    ratioDropdown.style.top = `${rect.bottom + 4}px`;
  }
});

ratioDropdown.addEventListener("click", (e) => {
  const btn = e.target.closest(".ratio-option");
  if (!btn) return;
  e.stopPropagation();
  const ratio = btn.dataset.ratio;
  updateRatioDisplay(ratio);
  ratioDropdown.classList.add("hidden");
  setSync({ lastRatio: ratio });
  debouncedCostEstimate();
});

// Close dropdown when clicking outside
document.addEventListener("click", (e) => {
  if (!ratioDropdown.classList.contains("hidden") && !e.target.closest(".generate-ratio-picker")) {
    ratioDropdown.classList.add("hidden");
  }
});

/* --- Attach button --- */

attachButton.addEventListener("click", () => imageUpload.click());

/* --- Cost estimation --- */

let costTimer = null;
let costAbort = null;

function showCostSkeleton() {
  costEstimate.classList.remove("hidden");
  costEstimate.classList.add("skeleton-cost");
  costEstimate.innerHTML = "&nbsp;";
}

function showCostValue(totalCostMicros) {
  costEstimate.classList.remove("hidden", "skeleton-cost");
  const dollars = totalCostMicros / 1_000_000;
  const formatted = dollars < 0.01 ? `$${dollars.toFixed(4)}` : `$${dollars.toFixed(2)}`;
  costEstimate.innerHTML = `Est. <span id="costValue">${formatted}</span>`;
}

function hideCostEstimate() {
  costEstimate.classList.add("hidden");
  costEstimate.classList.remove("skeleton-cost");
  costEstimate.innerHTML = 'Est. <span id="costValue">$0.00</span>';
}

async function fetchCostEstimate() {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) { hideCostEstimate(); return; }

  const { baseUrl } = await getLocal(["baseUrl"]);
  const base = baseUrl || DEFAULT_BASE_URL;
  if (costAbort) costAbort.abort();
  costAbort = new AbortController();
  showCostSkeleton();

  try {
    const isEdit = pendingEditImages.length > 0;
    let data;
    if (isEdit && pendingEditImages[0]) {
      const form = new FormData();
      form.append("model", modelSelect.value);
      form.append("prompt", promptInput.value.trim() || "estimate");
      const imgSrc = pendingEditImages[0];
      let blob;
      if (imgSrc.startsWith("data:")) {
        blob = dataUrlToBlob(imgSrc);
      } else {
        await ensureHostAccess(imgSrc);
        blob = await fetch(imgSrc).then((r) => r.blob());
      }
      form.append("image", new File([blob], "img.png", { type: blob.type }));
      const res = await fetch(`${base}/images/edits?dryRun=true`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: costAbort.signal
      });
      data = await res.json();
    } else {
      const res = await fetch(`${base}/images/generations?dryRun=true`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: modelSelect.value,
          prompt: promptInput.value.trim() || "estimate",
          aspect_ratio: ratioSelect.value,
          n: parseInt(generateCountSelect.value, 10) || 1
        }),
        signal: costAbort.signal
      });
      data = await res.json();
    }
    if (data.estimated && typeof data.total_cost_micros === "number") {
      showCostValue(data.total_cost_micros);
    } else {
      hideCostEstimate();
    }
  } catch (e) {
    if (e.name !== "AbortError") hideCostEstimate();
  }
}

function debouncedCostEstimate() {
  clearTimeout(costTimer);
  costTimer = setTimeout(fetchCostEstimate, 500);
}

function setDropzoneState(text, imageSrcs = []) {
  // Render file previews inline in action bar (platform-style)
  filePreviewContainer.innerHTML = "";

  if (!imageSrcs.length) return;

  imageSrcs.forEach((src, idx) => {
    const thumb = document.createElement("div");
    thumb.className = "file-preview-thumb";

    const img = document.createElement("img");
    img.src = src;
    img.alt = "Input image";
    thumb.appendChild(img);

    const removeBtn = document.createElement("button");
    removeBtn.className = "file-preview-remove";
    removeBtn.title = "Remove";
    removeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      pendingEditImages.splice(idx, 1);
      setDropzoneState("", [...pendingEditImages]);
      debouncedCostEstimate();
      updateEditModelWarning();
    });
    thumb.appendChild(removeBtn);

    filePreviewContainer.appendChild(thumb);
  });
}

/* --- Textarea auto-grow (ported from platform auto_grow_textarea_controller) --- */

function autoGrowTextarea(animate = true) {
  const ta = promptInput;
  if (generateForm.classList.contains("generate-form-minified")) return;
  const prev = ta.style.transition;
  if (!animate) ta.style.transition = "none";
  const cur = ta.offsetHeight;
  ta.style.height = "auto";
  const next = ta.scrollHeight;
  if (animate && Math.abs(cur - next) > 1) {
    ta.style.height = `${cur}px`;
    ta.offsetHeight; // reflow
    ta.style.height = `${next}px`;
  } else {
    ta.style.height = `${next}px`;
  }
  if (!animate) { ta.offsetHeight; ta.style.transition = prev; }
}

/* --- Generate form minification --- */

function minifyGenerateForm() {
  generateForm.classList.add("generate-form-minified");
  promptInput.style.height = "auto";
}

function expandGenerateForm() {
  generateForm.classList.remove("generate-form-minified");
  autoGrowTextarea();
}

// Expand form when clicking into prompt area in minified state (works even when textarea is disabled)
generateContainer.addEventListener("click", (e) => {
  // Don't expand if user clicked an interactive element (button, select, link)
  if (e.target.closest("button, select, a")) return;
  if (generateForm.classList.contains("generate-form-minified")) {
    expandGenerateForm();
  }
});
// Also listen on the outer form for clicks on the model selector area
generateForm.addEventListener("click", (e) => {
  if (e.target.closest("button, select, a, .model-selector-overlay")) return;
  if (generateForm.classList.contains("generate-form-minified")) {
    expandGenerateForm();
  }
});

function showGalleryBadge() {
  galleryBadge.classList.remove("hidden");
}

function hideGalleryBadge() {
  galleryBadge.classList.add("hidden");
}

function showOutputCard() {
  generateOutput.classList.remove("hidden");
}

function hideOutputCard() {
  generateOutput.classList.add("hidden");
  generateResults.innerHTML = "";
  generateStatus.textContent = "";
}

function renderGenerateResultSkeleton(count) {
  generateResults.innerHTML = "";
  showOutputCard();
  for (let i = 0; i < count; i++) {
    const card = document.createElement("div");
    card.className = "generate-result-card";
    card.innerHTML = '<div class="generate-result-img"><div class="skeleton skeleton-image"></div></div>';
    generateResults.appendChild(card);
  }
}

function fillGenerateResult(index, imageUrl, prompt) {
  const cards = generateResults.querySelectorAll(".generate-result-card");
  const card = cards[index];
  if (!card) return;

  const imgWrap = card.querySelector(".generate-result-img");
  imgWrap.innerHTML = "";

  const img = document.createElement("img");
  img.src = imageUrl;
  img.alt = prompt || "Generated image";
  img.loading = "lazy";
  setupDragSource(img, { url: imageUrl, prompt }, card);
  imgWrap.appendChild(img);

  const dragBar = document.createElement("div");
  dragBar.className = "gallery-drag-bar";
  dragBar.title = "Drag image to another app or page";
  dragBar.innerHTML = '<span class="gallery-grip-icon">⠿</span> Drag';
  setupDragSource(dragBar, { url: imageUrl, prompt }, card);
  imgWrap.appendChild(dragBar);

  // Actions
  const actions = document.createElement("div");
  actions.className = "generate-result-actions";

  const copyBtn = document.createElement("button");
  copyBtn.className = "secondary";
  copyBtn.textContent = "Copy";
  copyBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    try {
      let blob;
      if (imageUrl.startsWith("data:")) {
        blob = dataUrlToBlob(imageUrl);
      } else {
        await ensureHostAccess(imageUrl);
        blob = await fetch(imageUrl).then((r) => r.blob());
      }
      await navigator.clipboard.write([new ClipboardItem({ [blob.type || "image/png"]: blob })]);
      copyBtn.textContent = "Copied!";
      setTimeout(() => { copyBtn.textContent = "Copy"; }, 1500);
    } catch (_) { navigator.clipboard.writeText(imageUrl); }
  });

  const dlBtn = document.createElement("button");
  dlBtn.className = "secondary";
  dlBtn.textContent = "Download";
  dlBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    try {
      let blobUrl;
      if (imageUrl.startsWith("data:")) {
        const blob = dataUrlToBlob(imageUrl);
        blobUrl = URL.createObjectURL(blob);
      } else {
        blobUrl = imageUrl;
      }
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = lumenfallFilename(imageUrl);
      a.click();
      if (blobUrl !== imageUrl) setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (_) { window.open(imageUrl, "_blank"); }
  });

  const editBtn = document.createElement("button");
  editBtn.className = "secondary";
  editBtn.textContent = "Edit";
  editBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    pendingEditImages = [imageUrl];
    setDropzoneState("1 image loaded.", [imageUrl]);
    updateEditModelWarning();
    expandGenerateForm();
    promptInput.focus();
  });

  actions.append(copyBtn, dlBtn, editBtn);
  card.appendChild(actions);
}

/* --- Settings persistence --- */

async function loadSettings() {
  const local = await getLocal(["apiKey", "baseUrl", "storedModels"]);
  const sync = await getSync([
    "lastModel", "lastRatio", "lastOutputFormat", "brainstormModel", "fastImageModel",
    "lastPrompt", "theme", "brainstormSystemPrompt",
    "contextMenuTipDismissed"
  ]);

  apiKeyInput.value = local.apiKey;
  baseUrlInput.value = local.baseUrl;
  promptInput.value = sync.lastPrompt;
  autoGrowTextarea(false);
  themeSelect.value = sync.theme;
  brainstormSystemPromptInput.value = sync.brainstormSystemPrompt || DEFAULT_BRAINSTORM_PROMPT;

  // Apply stored models (stay empty if none stored yet)
  if (Array.isArray(local.storedModels) && local.storedModels.length) {
    const normalized = normalizeModels(local.storedModels);
    allModels = normalized;
    const categorized = categorizeModels(local.storedModels);
    imageModels = categorized.image;
    editModels = categorized.edit || [];
    // Always offer google/gemini-3-flash-preview for brainstorm
    const gemini = { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash" };
    const extraChat = categorized.chat.filter((m) => m.id !== gemini.id);
    chatModels = [gemini, ...extraChat];
  }
  updateModelSelects();

  // Restore selections after populating (fall back to first featured, then first overall)
  if (sync.lastModel) modelSelect.value = sync.lastModel;
  if (!modelSelect.value) {
    const defaultModel = generationModels.find((m) => m.featured) || generationModels[0];
    if (defaultModel) modelSelect.value = defaultModel.id;
  }
  // Update trigger to show currently selected model
  const defaultFallback = generationModels.find((m) => m.featured) || generationModels[0];
  const selectedModel = allModels.find((m) => m.id === modelSelect.value) || defaultFallback;
  if (selectedModel) updateModelTrigger(selectedModel);
  if (sync.lastRatio) {
    ratioSelect.value = sync.lastRatio;
    updateRatioDisplay(sync.lastRatio);
  }
  if (sync.lastOutputFormat) outputFormatSelect.value = sync.lastOutputFormat;
  if (sync.brainstormModel) brainstormModelSelect.value = sync.brainstormModel;
  if (!brainstormModelSelect.value && brainstormModelSelect.options.length) brainstormModelSelect.selectedIndex = 0;
  fastImageModelSelect.value = sync.fastImageModel || DEFAULT_FAST_IMAGE_MODEL;
  if (!fastImageModelSelect.value && fastImageModelSelect.options.length) fastImageModelSelect.selectedIndex = 0;

  toggleSettingsVisibility(!local.apiKey);
  updateFeatureAvailability();
  applyTheme(sync.theme);

  // Context menu tip
  if (!sync.contextMenuTipDismissed) {
    contextMenuTip.classList.remove("hidden");
  }

  // Load gallery
  refreshGallery();

  // Check for pending edit image from context menu
  checkPendingEditImage();

  // Fetch balance (non-blocking)
  fetchBalance();

  // Initial cost estimate (non-blocking)
  debouncedCostEstimate();

  // Check drag permission for the active tab
  updateDragPermissionBanner();
}

/* --- Settings event listeners --- */

apiKeyInput.addEventListener("input", () => {
  setLocal({ apiKey: apiKeyInput.value.trim() });
  updateFeatureAvailability();
});

apiKeyInput.addEventListener("blur", loadModels);

baseUrlInput.addEventListener("input", () => {
  setLocal({ baseUrl: baseUrlInput.value.trim() || DEFAULT_BASE_URL });
});

promptInput.addEventListener("input", () => {
  autoGrowTextarea();
  setSync({ lastPrompt: promptInput.value });
  promptInput.classList.remove("field-error");
  debouncedCostEstimate();
});

modelSelect.addEventListener("change", () => { setSync({ lastModel: modelSelect.value }); debouncedCostEstimate(); });
ratioSelect.addEventListener("change", () => { setSync({ lastRatio: ratioSelect.value }); debouncedCostEstimate(); });
brainstormModelSelect.addEventListener("change", () => setSync({ brainstormModel: brainstormModelSelect.value }));
fastImageModelSelect.addEventListener("change", () => setSync({ fastImageModel: fastImageModelSelect.value }));
generateCountSelect.addEventListener("change", () => debouncedCostEstimate());
outputFormatSelect.addEventListener("change", () => setSync({ lastOutputFormat: outputFormatSelect.value }));

themeSelect.addEventListener("change", () => {
  const theme = themeSelect.value;
  setSync({ theme });
  applyTheme(theme);
});

brainstormSystemPromptInput.addEventListener("input", () => {
  setSync({ brainstormSystemPrompt: brainstormSystemPromptInput.value });
});

resetBrainstormPromptButton.addEventListener("click", () => {
  brainstormSystemPromptInput.value = DEFAULT_BRAINSTORM_PROMPT;
  setSync({ brainstormSystemPrompt: DEFAULT_BRAINSTORM_PROMPT });
});

settingsButton.addEventListener("click", () => {
  const isOpen = !settingsPanel.classList.contains("hidden");
  toggleSettingsVisibility(!isOpen);
});
closeSettingsButton.addEventListener("click", () => toggleSettingsVisibility(false));
saveSettingsButton.addEventListener("click", () => {
  toggleSettingsVisibility(false);
  loadModels();
});

reloadModelsButton.addEventListener("click", loadModels);

restoreDefaultsButton.addEventListener("click", async () => {
  // Reset local settings (keep apiKey, clear everything else)
  await setLocal({ baseUrl: DEFAULT_BASE_URL, storedModels: [] });
  // Reset all sync settings
  await setSync({
    lastModel: "",
    lastRatio: "1:1",
    brainstormModel: "",
    fastImageModel: DEFAULT_FAST_IMAGE_MODEL,
    lastPrompt: "",
    theme: "auto",
    brainstormSystemPrompt: "",
    lastOutputFormat: "",
    contextMenuTipDismissed: false
  });
  // Update UI to reflect defaults
  baseUrlInput.value = "";
  themeSelect.value = "auto";
  applyTheme("auto");
  brainstormSystemPromptInput.value = DEFAULT_BRAINSTORM_PROMPT;
  promptInput.value = "";
  ratioSelect.value = "1:1";
  outputFormatSelect.value = "";
  fastImageModelSelect.value = DEFAULT_FAST_IMAGE_MODEL;
  settingsStatus.textContent = "Defaults restored.";
  loadModels();
});

/* --- Context menu tip --- */

document.getElementById("dismissContextMenuTip")?.addEventListener("click", () => {
  contextMenuTip.classList.add("hidden");
  setSync({ contextMenuTipDismissed: true });
});

/* --- Gallery --- */

clearGalleryButton?.addEventListener("click", async () => {
  await clearGallery();
  refreshGallery();
});

/* --- Balance display --- */

async function fetchBalance() {
  const { baseUrl } = await getLocal(["baseUrl"]);
  const base = baseUrl || DEFAULT_BASE_URL;
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) return;

  try {
    const apiRoot = base.replace(/\/openai\/v1\/?$/, "");
    const data = await fetchJson(`${apiRoot}/v1/balance`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });

    const amount = data.available?.amount;
    if (data.billing_type === "postpaid" || amount == null) {
      balanceDisplay.classList.add("hidden");
      lowBalanceBanner.classList.add("hidden");
      return;
    }
    balanceDisplay.textContent = `$${amount.toFixed(2)}`;
    balanceDisplay.classList.remove("hidden");

    if (amount < 0.50) {
      lowBalanceBanner.classList.remove("hidden");
    } else {
      lowBalanceBanner.classList.add("hidden");
    }
  } catch {
    // Silently fail — balance display is non-critical
  }
}

/* --- Model loading --- */

async function loadModels() {
  const { baseUrl } = await getLocal(["baseUrl"]);
  const base = baseUrl || DEFAULT_BASE_URL;
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    settingsStatus.textContent = "Add an API key to load models.";
    return;
  }

  try {
    settingsStatus.textContent = "Loading models\u2026";
    const data = await fetchJson(`${base}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    const raw = data.data || [];
    const models = normalizeModels(raw);
    allModels = models;
    const categorized = categorizeModels(raw);
    imageModels = categorized.image;
    editModels = categorized.edit || [];
    // Always offer google/gemini-3-flash-preview for brainstorm, plus any chat models from API
    const gemini = { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash" };
    const extraChat = categorized.chat.filter((m) => m.id !== gemini.id);
    chatModels = [gemini, ...extraChat];
    await setLocal({ storedModels: raw });
    updateModelSelects();
    // Restore fast image model preference after repopulating selects
    const { fastImageModel } = await getSync(["fastImageModel"]);
    fastImageModelSelect.value = fastImageModel || DEFAULT_FAST_IMAGE_MODEL;
    if (!fastImageModelSelect.value && fastImageModelSelect.options.length) fastImageModelSelect.selectedIndex = 0;
    settingsStatus.textContent = `Loaded ${models.length} model(s).`;
    fetchBalance();
  } catch (error) {
    settingsStatus.textContent = `Unable to load models: ${error.message}`;
  }
}

/* --- Image generation --- */

let generateAbort = null;

async function generateImages({ apiKey, baseUrl, model, prompt, aspect_ratio, n = 1, output_format, signal }) {
  const body = { model, prompt, aspect_ratio, n, response_format: "b64_json" };
  if (output_format) body.output_format = output_format;
  return fetchJson(`${baseUrl}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body),
    signal
  });
}

async function editImage({ apiKey, baseUrl, model, prompt, imageData, output_format, signal }) {
  const form = new FormData();
  form.append("model", model);
  form.append("prompt", prompt);
  form.append("response_format", "b64_json");
  if (output_format) form.append("output_format", output_format);

  if (imageData?.startsWith("data:")) {
    // Convert data URL to File for multipart upload
    const blob = dataUrlToBlob(imageData);
    form.append("image", new File([blob], "image.png", { type: blob.type }));
  } else if (imageData) {
    // Fetch the remote image and convert to File
    try {
      await ensureHostAccess(imageData);
      const resp = await fetch(imageData);
      const blob = await resp.blob();
      form.append("image", new File([blob], "image.png", { type: blob.type || "image/png" }));
    } catch (err) {
      throw new Error(`Failed to fetch input image: ${err.message}`);
    }
  }

  // Do NOT set Content-Type — browser sets it with the correct multipart boundary
  return fetchJson(`${baseUrl}/images/edits`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: form,
    signal
  });
}

async function handleGenerate() {
  const apiKey = requireApiKey(apiWarning);
  if (!apiKey) return;

  const { baseUrl } = await getLocal(["baseUrl"]);
  const base = baseUrl || DEFAULT_BASE_URL;
  const model = modelSelect.value;
  const aspect_ratio = ratioSelect.value;
  const prompt = promptInput.value.trim();
  const count = parseInt(generateCountSelect.value, 10) || 1;
  const output_format = outputFormatSelect.value || undefined;
  const isEdit = pendingEditImages.length > 0;

  if (!prompt) {
    generateInputStatus.textContent = "Enter a prompt to generate an image.";
    promptInput.classList.add("field-error");
    promptInput.focus();
    return;
  }
  if (prompt.length > 10000) {
    generateInputStatus.textContent = "Prompt is too long (max 10,000 characters).";
    return;
  }
  promptInput.classList.remove("field-error");
  generateInputStatus.textContent = "";

  // Prevent re-entry if already generating
  if (generateAbort) return;

  // Minify form and show skeleton loaders
  minifyGenerateForm();
  const expectedCount = isEdit ? pendingEditImages.length : count;
  renderGenerateResultSkeleton(expectedCount);
  generateStatus.textContent = "";

  generateAbort = new AbortController();
  const signal = generateAbort.signal;

  // Loading state — button becomes Cancel
  generateButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12" rx="1"></rect></svg><span>Stop</span>';
  generateButton.classList.remove("primary");
  generateButton.classList.add("secondary");
  promptInput.disabled = true;

  const startTime = performance.now();

  try {
    let urls;
    if (isEdit) {
      urls = [];
      for (const imageData of pendingEditImages) {
        const data = await editImage({ apiKey, baseUrl: base, model, prompt, imageData, output_format, signal });
        urls.push(...normalizeImageData(data));
      }
    } else {
      const data = await generateImages({ apiKey, baseUrl: base, model, prompt, aspect_ratio, n: count, output_format, signal });
      urls = normalizeImageData(data);
    }

    if (!urls.length) {
      throw new Error("No images were returned. Try a different prompt or model.");
    }

    const durationMs = Math.round(performance.now() - startTime);

    // Save to gallery + show inline results (progressive: fill each card as data arrives)
    for (let i = 0; i < urls.length; i++) {
      try {
        const dataUrl = urls[i].startsWith("data:") ? urls[i] : await fetchImageAsDataUrl(urls[i]);
        await addGalleryItem({ url: dataUrl, prompt, model, aspect_ratio, timestamp: Date.now() + i, duration_ms: durationMs });
        fillGenerateResult(i, dataUrl, prompt);
      } catch (_) {
        await addGalleryItem({ url: urls[i], prompt, model, aspect_ratio, timestamp: Date.now() + i, duration_ms: durationMs });
        fillGenerateResult(i, urls[i], prompt);
      }
    }

    generateStatus.textContent = `Generated ${urls.length} image(s).`;

    // Show gallery badge (notification dot) instead of switching tabs
    showGalleryBadge();
    fetchBalance();
  } catch (error) {
    expandGenerateForm();
    if (error.name === "AbortError") {
      // On cancel, hide the output card entirely
      hideOutputCard();
    } else {
      // Show error inline in the results area so it's visible
      generateResults.innerHTML = "";
      const errorCard = document.createElement("div");
      errorCard.className = "generate-error-card";
      errorCard.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><div class="generate-error-message">${error.message}</div>`;
      generateResults.appendChild(errorCard);
      generateStatus.textContent = "";
    }
  } finally {
    generateAbort = null;
    generateButton.classList.remove("secondary");
    generateButton.classList.add("primary");
    generateButton.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6,3 20,12 6,21"></polygon></svg><span>Run</span>';
    promptInput.disabled = false;
    updateFeatureAvailability();
  }
}

generateButton.addEventListener("click", () => {
  if (generateAbort) {
    // Currently generating — cancel it
    generateAbort.abort();
  } else {
    handleGenerate();
  }
});

/* --- Clear (no dedicated button — user can select-all + delete in textarea) --- */

/* --- Image upload / dropzone --- */

async function handleImageFiles(files, append = false) {
  if (!files?.length) return;
  const dataUrls = [];
  for (const file of files) {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Unable to read image."));
      reader.readAsDataURL(file);
    });
    dataUrls.push(dataUrl);
  }
  if (append) {
    pendingEditImages = [...pendingEditImages, ...dataUrls];
  } else {
    pendingEditImages = dataUrls;
  }
  setDropzoneState(`${pendingEditImages.length} image(s) loaded.`, pendingEditImages);
  debouncedCostEstimate();
  updateEditModelWarning();
}

async function handleImageUrl(url) {
  if (!url) return;

  // data: URLs can be used directly — no fetch needed
  if (url.startsWith("data:")) {
    pendingEditImages = [url];
    setDropzoneState("1 image loaded.", [url]);
    updateEditModelWarning();
    return;
  }

  pendingEditImages = [url];
  // Show loading state immediately
  setDropzoneState("Loading image\u2026");
  // Fetch and convert to data URL so it displays in the extension context
  // (MV3 CSP blocks external URLs in img-src, but fetch works with host_permissions)
  try {
    const dataUrl = await fetchImageAsDataUrl(url);
    pendingEditImages = [dataUrl];
    setDropzoneState("1 image loaded.", [dataUrl]);
  } catch (_) {
    // URL still works for API calls, just no visual preview
    setDropzoneState("1 image loaded (preview unavailable).");
  }
  updateEditModelWarning();
}

/* Drag & drop on container (platform-style: full drag overlay) */
generateContainer.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.stopPropagation();
  dragOverlay.hidden = false;
});
generateContainer.addEventListener("dragleave", (e) => {
  // Only hide if leaving the container entirely (not entering a child)
  if (!generateContainer.contains(e.relatedTarget)) {
    dragOverlay.hidden = true;
  }
});
generateContainer.addEventListener("drop", (e) => {
  e.preventDefault();
  e.stopPropagation();
  dragOverlay.hidden = true;

  const files = Array.from(e.dataTransfer.files || []);
  if (files.length) {
    handleImageFiles(files);
    return;
  }

  // Check HTML first — when dragging an <img> from a webpage, text/uri-list often
  // contains the *page* URL (e.g. Wikipedia File: page) rather than the actual image.
  const html = e.dataTransfer.getData("text/html") || "";
  const srcMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (srcMatch?.[1]) {
    let imgSrc = srcMatch[1];
    if (imgSrc.startsWith("//")) imgSrc = "https:" + imgSrc;
    handleImageUrl(imgSrc);
    return;
  }

  // Fallback: text/uri-list or text/plain
  const rawUri = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain") || "";
  const url = rawUri.split("\n").map((l) => l.trim()).find((l) => l.match(/^https?:\/\/.+/i)) || "";
  if (url) {
    handleImageUrl(url);
  }
});

imageUpload.addEventListener("change", (e) => {
  const shouldAppend = pendingEditImages.length > 0;
  handleImageFiles(Array.from(e.target.files || []), shouldAppend);
  imageUpload.value = "";
});

/* --- Context menu edit image --- */

async function checkPendingEditImage() {
  try {
    const { pendingEditImage } = await new Promise((resolve) => {
      chrome.storage.local.get({ pendingEditImage: "" }, resolve);
    });
    if (!pendingEditImage) return;
    await consumePendingEditImage(pendingEditImage);
  } catch (_) {}
}

async function consumePendingEditImage(imageUrl) {
  // Clear immediately so it doesn't reload on next open
  await new Promise((resolve) => {
    chrome.storage.local.remove("pendingEditImage", resolve);
  });

  // Expand form if minified, clear previous results
  expandGenerateForm();
  hideOutputCard();

  // Load the image into the dropzone as an edit input
  await handleImageUrl(imageUrl);

  // Switch to generate tab
  setTabs("generate");

  // Focus the prompt so the user can start typing their edit instruction
  promptInput.focus();
}

// Listen for context menu edits while popup/sidebar is already open
// (sidePanel.open() is a no-op when the panel is already showing,
//  so checkPendingEditImage at page load won't see the new value)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.pendingEditImage?.newValue) {
    consumePendingEditImage(changes.pendingEditImage.newValue);
  }
});

// When a host permission is granted after handleImageUrl failed to fetch,
// retry converting any raw URLs in pendingEditImages to data URLs for preview.
chrome.permissions.onAdded.addListener(async () => {
  const rawIndexes = pendingEditImages
    .map((u, i) => (!u.startsWith("data:") && !u.startsWith("blob:")) ? i : -1)
    .filter((i) => i >= 0);
  if (!rawIndexes.length) return;

  let changed = false;
  for (const i of rawIndexes) {
    try {
      const dataUrl = await fetchImageAsDataUrl(pendingEditImages[i]);
      pendingEditImages[i] = dataUrl;
      changed = true;
    } catch (_) {}
  }
  if (changed) {
    setDropzoneState(`${pendingEditImages.length} image(s) loaded.`, pendingEditImages);
  }
});

/* --- Content script helpers --- */

async function getPageText() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id || !tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) {
      return { title: "", text: "" };
    }
    // Ensure we have host permission before injecting (the brainstorm button click
    // that calls this function provides the user-gesture context for the request).
    const granted = await ensureHostAccess(tab.url);
    if (!granted) return { title: "", text: "" };
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const title = document.title || "";

        // Try semantic containers first
        const selectors = [
          "article",
          "main",
          '[role="main"]',
          ".post-content",
          ".article-body",
          ".entry-content",
          ".post-body",
          ".story-body",
          ".content-body"
        ];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el && el.innerText.trim().length > 200) {
            return { title, text: el.innerText.trim() };
          }
        }

        // Fallback: find the largest text block
        const blocks = document.querySelectorAll("div, section, td");
        let best = null;
        let bestLen = 0;
        for (const block of blocks) {
          const len = block.innerText?.trim().length || 0;
          if (len > bestLen && len > 200) {
            best = block;
            bestLen = len;
          }
        }
        if (best) {
          return { title, text: best.innerText.trim() };
        }

        // Last resort: body
        return { title, text: (document.body?.innerText || "").trim() };
      }
    });
    const result = results?.[0]?.result || { title: "", text: "" };
    // Cap at 6000 chars
    result.text = result.text.slice(0, 6000);
    return result;
  } catch (_) {
    return { title: "", text: "" };
  }
}

/* --- Illustrate (brainstorm) --- */

async function brainstormPrompts({ apiKey, baseUrl, model, pageText, systemPrompt }) {
  const userContent = pageText.title
    ? `Title: ${pageText.title}\n\n${pageText.text}`
    : pageText.text;
  return fetchJson(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt || DEFAULT_BRAINSTORM_PROMPT },
        { role: "user", content: userContent }
      ]
    })
  });
}

function parsePromptList(content) {
  return content
    .split("\n")
    .map((line) => line.replace(/^[-*\d.\s]+/, "").trim())
    .filter(Boolean);
}

function renderBrainstormCard(prompt, index) {
  const card = document.createElement("div");
  card.className = "brainstorm-card";
  card.dataset.index = index;

  // Image area (starts as loading placeholder)
  const imgWrap = document.createElement("div");
  imgWrap.className = "brainstorm-card-img";
  const spinner = document.createElement("div");
  spinner.className = "brainstorm-card-loading";
  spinner.innerHTML = '<span class="spinner"></span>';
  imgWrap.appendChild(spinner);
  card.appendChild(imgWrap);

  // Prompt caption
  const caption = document.createElement("div");
  caption.className = "brainstorm-card-prompt";
  caption.textContent = prompt;
  caption.title = prompt;
  card.appendChild(caption);

  // Actions (hidden until image loads)
  const actions = document.createElement("div");
  actions.className = "brainstorm-card-actions hidden";
  card.appendChild(actions);

  brainstormResults.appendChild(card);
  return card;
}

function fillBrainstormCard(card, imageUrl, prompt) {
  const imgWrap = card.querySelector(".brainstorm-card-img");
  imgWrap.innerHTML = "";

  const img = document.createElement("img");
  img.src = imageUrl;
  img.alt = prompt;
  img.loading = "lazy";
  setupDragSource(img, { url: imageUrl, prompt }, card);
  imgWrap.appendChild(img);

  const dragBar = document.createElement("div");
  dragBar.className = "gallery-drag-bar";
  dragBar.title = "Drag image to another app or page";
  dragBar.innerHTML = '<span class="gallery-grip-icon">⠿</span> Drag';
  setupDragSource(dragBar, { url: imageUrl, prompt }, card);
  imgWrap.appendChild(dragBar);

  // Show actions
  const actions = card.querySelector(".brainstorm-card-actions");
  actions.classList.remove("hidden");
  actions.innerHTML = "";

  // Copy button
  const copyBtn = document.createElement("button");
  copyBtn.className = "secondary";
  copyBtn.textContent = "Copy";
  copyBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    try {
      let blob;
      if (imageUrl.startsWith("data:")) {
        blob = dataUrlToBlob(imageUrl);
      } else {
        await ensureHostAccess(imageUrl);
        blob = await fetch(imageUrl).then((r) => r.blob());
      }
      await navigator.clipboard.write([new ClipboardItem({ [blob.type || "image/png"]: blob })]);
      copyBtn.textContent = "Copied!";
      setTimeout(() => { copyBtn.textContent = "Copy"; }, 1500);
    } catch (_) {
      navigator.clipboard.writeText(imageUrl);
    }
  });

  // Download button
  const dlBtn = document.createElement("button");
  dlBtn.className = "secondary";
  dlBtn.textContent = "Download";
  dlBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    try {
      let blobUrl;
      if (imageUrl.startsWith("data:")) {
        const blob = dataUrlToBlob(imageUrl);
        blobUrl = URL.createObjectURL(blob);
      } else {
        blobUrl = imageUrl;
      }
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = lumenfallFilename(imageUrl, "lumenfall-illustrate");
      a.click();
      if (blobUrl !== imageUrl) setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (_) {
      window.open(imageUrl, "_blank");
    }
  });

  // Regenerate button
  const regenBtn = document.createElement("button");
  regenBtn.className = "secondary";
  regenBtn.textContent = "Regenerate";
  regenBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) return;
    const { baseUrl } = await getLocal(["baseUrl"]);
    const base = baseUrl || DEFAULT_BASE_URL;
    const model = fastImageModelSelect.value;

    // Show loading in this card
    imgWrap.innerHTML = '<div class="brainstorm-card-loading"><span class="spinner"></span></div>';
    actions.classList.add("hidden");

    try {
      const data = await generateImages({ apiKey, baseUrl: base, model, prompt, aspect_ratio: "16:9", n: 1 });
      const urls = normalizeImageData(data);
      if (urls.length) {
        const newUrl = urls[0].startsWith("data:") ? urls[0] : await fetchImageAsDataUrl(urls[0]);
        await addGalleryItem({ url: newUrl, prompt, model, aspect_ratio: "16:9", timestamp: Date.now() });
        fillBrainstormCard(card, newUrl, prompt);
      }
    } catch (err) {
      imgWrap.innerHTML = `<div class="brainstorm-card-error">${err.message}</div>`;
      actions.classList.remove("hidden");
    }
  });

  actions.append(copyBtn, dlBtn, regenBtn);
}

function showBrainstormCardError(card, message) {
  const imgWrap = card.querySelector(".brainstorm-card-img");
  imgWrap.innerHTML = `<div class="brainstorm-card-error">${message}</div>`;
}

// Extracted text toggle
extractedTextToggle?.addEventListener("click", () => {
  const isOpen = !extractedTextBody.classList.contains("hidden");
  extractedTextBody.classList.toggle("hidden", isOpen);
  extractedTextToggle.innerHTML = isOpen ? "Extracted text &#9662;" : "Extracted text &#9652;";
});

brainstormButton.addEventListener("click", async () => {
  const apiKey = requireApiKey(brainstormWarning);
  if (!apiKey) return;

  // Reset UI
  brainstormResults.innerHTML = "";
  brainstormStatus.textContent = "";
  extractedTextContainer.classList.add("hidden");

  brainstormButton.disabled = true;
  brainstormButton.innerHTML = '<span class="spinner"></span> Reading page\u2026';

  try {
    // Step 1: Extract page text
    const pageText = await getPageText();
    if (!pageText.text) {
      brainstormStatus.textContent = "No page content found. Navigate to an article and try again.";
      return;
    }

    // Show extracted text
    extractedTextContainer.classList.remove("hidden");
    extractedTextBody.textContent = pageText.title
      ? `${pageText.title}\n\n${pageText.text.slice(0, 500)}${pageText.text.length > 500 ? "…" : ""}`
      : pageText.text.slice(0, 500) + (pageText.text.length > 500 ? "…" : "");

    // Step 2: Generate prompts
    brainstormButton.innerHTML = '<span class="spinner"></span> Brainstorming\u2026';
    const { baseUrl } = await getLocal(["baseUrl"]);
    const base = baseUrl || DEFAULT_BASE_URL;
    const data = await brainstormPrompts({
      apiKey,
      baseUrl: base,
      model: brainstormModelSelect.value,
      pageText,
      systemPrompt: brainstormSystemPromptInput.value
    });
    const content = data?.choices?.[0]?.message?.content || "";
    const prompts = parsePromptList(content);

    if (!prompts.length) {
      brainstormStatus.textContent = "No prompts generated. Try a different page.";
      return;
    }

    // Step 3: Create cards and generate images in parallel
    brainstormButton.innerHTML = '<span class="spinner"></span> Generating images\u2026';
    const model = fastImageModelSelect.value;

    const cards = prompts.map((prompt, i) => renderBrainstormCard(prompt, i));

    await Promise.allSettled(
      prompts.map(async (prompt, i) => {
        try {
          const imgData = await generateImages({ apiKey, baseUrl: base, model, prompt, aspect_ratio: "16:9", n: 1 });
          const urls = normalizeImageData(imgData);
          if (urls.length) {
            const imageUrl = urls[0].startsWith("data:") ? urls[0] : await fetchImageAsDataUrl(urls[0]);
            await addGalleryItem({ url: imageUrl, prompt, model, aspect_ratio: "16:9", timestamp: Date.now() });
            fillBrainstormCard(cards[i], imageUrl, prompt);
          } else {
            showBrainstormCardError(cards[i], "No image returned");
          }
        } catch (err) {
          showBrainstormCardError(cards[i], err.message);
        }
      })
    );

    brainstormStatus.textContent = `Generated ${prompts.length} illustration(s). Images saved to gallery.`;
  } catch (error) {
    brainstormStatus.textContent = `Error: ${error.message}`;
  } finally {
    brainstormButton.disabled = false;
    brainstormButton.textContent = "Brainstorm this page";
    updateFeatureAvailability();
  }
});

/* --- Consent gate --- */

const consentOverlay = document.getElementById("consentOverlay");
const consentAcceptButton = document.getElementById("consentAccept");

async function checkConsent() {
  const { dataConsentGiven } = await getSync(["dataConsentGiven"]);
  if (dataConsentGiven) {
    loadSettings();
  } else {
    consentOverlay.classList.remove("hidden");
  }
}

consentAcceptButton.addEventListener("click", async () => {
  await setSync({ dataConsentGiven: true });
  consentOverlay.classList.add("hidden");
  loadSettings();
});

/* --- Init --- */

checkConsent();
