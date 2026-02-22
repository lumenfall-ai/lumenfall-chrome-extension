const imageUrlInput = document.getElementById("imageUrl");
const sourceImage = document.getElementById("sourceImage");
const editModelSelect = document.getElementById("editModel");
const editPromptInput = document.getElementById("editPrompt");
const editButton = document.getElementById("editButton");
const editStatus = document.getElementById("editStatus");
const editResults = document.getElementById("editResults");

const FALLBACK_MODELS = window.LUMENFALL_MODELS;
let editModels = [];

function populateSelect(select, items) {
  select.innerHTML = "";
  items.forEach((model) => {
    const option = document.createElement("option");
    option.value = model.id;
    option.textContent = model.label || model.id;
    select.appendChild(option);
  });
}

function updateModelSelect() {
  populateSelect(editModelSelect, editModels);
}

updateModelSelect();

function getQueryImageUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("imageUrl") || "";
}

function updateSourceImage() {
  const url = imageUrlInput.value.trim();
  sourceImage.src = url;
}

imageUrlInput.addEventListener("input", updateSourceImage);

function renderResult(url) {
  const card = document.createElement("div");
  card.className = "result-card";

  const img = document.createElement("img");
  img.src = url;
  img.alt = "Edited image";

  const actions = document.createElement("div");
  actions.className = "actions";

  const copyButton = document.createElement("button");
  copyButton.textContent = "Copy URL";
  copyButton.className = "secondary";
  copyButton.addEventListener("click", async () => {
    await navigator.clipboard.writeText(url);
  });

  const downloadButton = document.createElement("button");
  downloadButton.textContent = "Download";
  downloadButton.className = "secondary";
  downloadButton.addEventListener("click", () => {
    const link = document.createElement("a");
    link.href = url;
    link.download = lumenfallFilename(url, "lumenfall-edit");
    link.click();
  });

  actions.append(copyButton, downloadButton);
  card.append(img, actions);
  editResults.prepend(card);
}

async function loadModels() {
  const local = await getLocal(["apiKey", "baseUrl"]);
  if (!local.apiKey) return;

  try {
    const data = await fetchJson(`${local.baseUrl || DEFAULT_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${local.apiKey}` }
    });
    const models = Array.isArray(data.data) ? data.data : [];
    const categorized = categorizeModels(models);
    editModels = categorized.edit;
    updateModelSelect();
  } catch (_) {
    updateModelSelect();
  }
}

async function handleEdit() {
  editStatus.textContent = "";
  const local = await getLocal(["apiKey", "baseUrl"]);

  if (!local.apiKey) {
    editStatus.textContent =
      "Add your API key in the popup settings. Visit lumenfall.ai to create an account and generate a key.";
    return;
  }

  const imageUrl = imageUrlInput.value.trim();
  const prompt = editPromptInput.value.trim();
  if (!imageUrl || !prompt) {
    editStatus.textContent = "Add an image URL and edit prompt.";
    return;
  }

  const baseUrl = local.baseUrl || DEFAULT_BASE_URL;

  editButton.disabled = true;
  editButton.innerHTML = '<span class="spinner"></span> Editing\u2026';

  try {
    const data = await fetchJson(`${baseUrl}/images/edits`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${local.apiKey}`
      },
      body: JSON.stringify({ model: editModelSelect.value, prompt, image_url: imageUrl })
    });
    const urls = normalizeImageData(data);
    urls.forEach(renderResult);
    editStatus.textContent = `Generated ${urls.length} edit(s).`;
  } catch (error) {
    editStatus.textContent = `Error: ${error.message}`;
  } finally {
    editButton.disabled = false;
    editButton.textContent = "Run edit";
  }
}

editButton.addEventListener("click", handleEdit);

const initialImage = getQueryImageUrl();
if (initialImage) {
  imageUrlInput.value = initialImage;
  updateSourceImage();
}

loadModels();
