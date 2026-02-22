const DEFAULT_BASE_URL = "https://api.lumenfall.ai/openai/v1";

/** Extract file extension from an image data URL or remote URL. */
function imageExtension(url) {
  if (url.startsWith("data:")) {
    const mime = url.match(/^data:(image\/\w+)/)?.[1];
    if (mime === "image/jpeg") return "jpg";
    if (mime === "image/webp") return "webp";
    if (mime === "image/gif") return "gif";
    if (mime === "image/avif") return "avif";
  }
  return "png";
}

/** Generate a timestamped download filename with the correct extension. */
function lumenfallFilename(url, prefix = "lumenfall") {
  return `${prefix}-${Date.now()}.${imageExtension(url)}`;
}

async function fetchJson(url, options = {}, { timeoutMs = 60000 } = {}) {
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);

  // Combine caller signal (for cancellation) with timeout signal
  const externalSignal = options.signal;
  let combinedSignal;
  if (externalSignal) {
    combinedSignal = AbortSignal.any
      ? AbortSignal.any([externalSignal, timeoutController.signal])
      : timeoutController.signal; // Fallback for older browsers
    // For browsers without AbortSignal.any, forward external abort
    if (!AbortSignal.any) {
      externalSignal.addEventListener("abort", () => timeoutController.abort(), { once: true });
    }
  } else {
    combinedSignal = timeoutController.signal;
  }

  try {
    const { signal: _discarded, ...restOptions } = options;
    const response = await fetch(url, { ...restOptions, signal: combinedSignal });
    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (_) {
      data = { message: text };
    }
    if (!response.ok) {
      const message = data?.error?.message || data?.message || `Request failed (${response.status})`;
      throw new Error(message);
    }
    // Some APIs return 200 with an error body
    if (data?.error?.message) {
      throw new Error(data.error.message);
    }
    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      // Re-throw as AbortError if caller cancelled, so handleGenerate can detect it
      if (externalSignal?.aborted) throw error;
      throw new Error("Request timed out. Please try again.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeImageData(data) {
  if (!data) return [];
  if (Array.isArray(data.data)) {
    return data.data
      .map((item) => item.url || (item.b64_json ? `data:image/png;base64,${item.b64_json}` : null))
      .filter(Boolean);
  }
  return [];
}

function normalizeModels(models) {
  if (!Array.isArray(models)) return [];
  return models.map((m) => ({
    id: m.id || m,
    label: m.name || m.label || m.id || m,
    description: m.description || "",
    creator: m.creator_organization || m.owned_by || "",
    featured: !!m.featured,
    status: m.model_status || "",
    price: m.starting_price ?? null,
    free: !!m.free,
    tags: m.tags || [],
    aliases: m.aliases || [],
    alternativeNames: m.alternative_names || [],
    imageUrl: m.image_url || "",
    modelPagePath: m.model_page_path || "",
    capabilities: m.capabilities || []
  }));
}

async function fetchImageAsDataUrl(url) {
  // Ensure we have host permission for this URL (optional_host_permissions)
  const granted = await ensureHostAccess(url);
  if (!granted) {
    throw new Error("Permission denied — the extension needs access to this site to fetch the image.");
  }
  const resp = await fetch(url);
  const blob = await resp.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(blob);
  });
}

function categorizeModels(models) {
  if (!Array.isArray(models)) return { image: [], edit: [], chat: [] };
  const image = [];
  const edit = [];
  const chat = [];
  const normalized = normalizeModels(models);
  normalized.forEach((m) => {
    const caps = (m.capabilities || []).map((c) => c.toLowerCase());
    const id = (m.id || "").toLowerCase();
    const modality = (models.find((raw) => (raw.id || raw) === m.id)?.modality || "").toLowerCase();
    const isEdit = caps.includes("inpainting") || caps.includes("editing") || id.includes("edit") || id.includes("inpaint");
    const isImage = modality === "image" || (!modality && !id.includes("chat"));
    const isChat = modality === "text" || id.includes("chat");

    // A model can belong to multiple categories (e.g. image + edit)
    const categories = [];
    if (isImage) categories.push("image");
    if (isEdit) categories.push("edit");
    if (isChat) categories.push("chat");
    m.categories = categories;

    // Primary category for bucket assignment
    if (isEdit) {
      m.category = "edit";
      edit.push(m);
    } else if (isChat) {
      m.category = "chat";
      chat.push(m);
    } else {
      m.category = "image";
      image.push(m);
    }
  });
  return { image, edit, chat };
}
