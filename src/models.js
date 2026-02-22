const MODELS = {
  image: [
    { id: "lumenfall-image-fast", label: "Image Fast", description: "Fast, affordable image generation", creator: "Lumenfall", featured: true },
    { id: "lumenfall-image-standard", label: "Image Standard", description: "Balanced quality and speed", creator: "Lumenfall" },
    { id: "lumenfall-image-hq", label: "Image HQ", description: "Highest quality image generation", creator: "Lumenfall" }
  ],
  edit: [
    { id: "lumenfall-image-edit", label: "Image Edit", description: "Edit and transform images with AI", creator: "Lumenfall" },
    { id: "lumenfall-image-inpaint", label: "Image Inpaint", description: "Intelligently fill or replace image regions", creator: "Lumenfall" }
  ],
  chat: [
    { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash", creator: "Google" }
  ]
};

if (typeof window !== "undefined") {
  window.LUMENFALL_MODELS = MODELS;
}
