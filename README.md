# Lumenfall AI Image Studio

A Chrome extension for generating and editing AI images directly in the browser, powered by [Lumenfall](https://lumenfall.ai).

Browse dozens of image models from providers like Flux, Recraft, Ideogram, and more — all through a single API key. Generate images from text prompts, edit existing images with inpainting models, and drag results straight into your workflow.

## Features

- **Generate images** from text prompts with model, aspect ratio, count, and output format controls.
- **Edit images** by attaching photos from your filesystem, dragging them from any webpage, or right-clicking any image and choosing "Edit with Lumenfall".
- **Rich model selector** with thumbnails, descriptions, pricing, and search across all available models.
- **Gallery** for browsing, copying, downloading, and re-editing your generated images.
- **Drag & drop** generated images directly into other apps, tabs, or upload targets.
- **Brainstorm mode** reads the current page and suggests illustration prompts tailored to the content.
- **Cost estimation** shows the estimated price before you run a generation.
- **Theming** with light, dark, and auto modes that match the Lumenfall dashboard.

## Install

### From the Chrome Web Store

*Coming soon.*

### From source (development)

1. Clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the repository root (the folder containing `manifest.json`).
5. Click the Lumenfall icon in the toolbar or press **Ctrl+Shift+L** (Mac: **Cmd+Shift+L**) to open the side panel.

## Setup

1. Create a free account at [lumenfall.ai](https://lumenfall.ai).
2. Generate an API key from your [dashboard](https://lumenfall.ai/app/api-keys).
3. Open the extension and paste the key in Settings.

Models are loaded automatically once a key is set. Your API key is stored locally on your device and is never synced or transmitted anywhere other than the Lumenfall API.

## Permissions

The extension requests the following permissions. Each is required for a specific feature:

| Permission | Why it's needed |
|---|---|
| `storage` | Store your API key, preferences, cached models, and gallery locally on your device. |
| `unlimitedStorage` | Gallery images are stored as data URLs which can exceed Chrome's default 10 MB storage quota. |
| `activeTab` | Access the current tab to extract page text (Brainstorm) and inject the drag & drop helper. |
| `scripting` | Inject content scripts on demand for page text extraction, image overlays, and drag & drop file reconstruction. |
| `contextMenus` | Add the "Edit with Lumenfall" option when you right-click an image on any webpage. |
| `sidePanel` | Display the extension as a Chrome side panel instead of a small popup. |

### Host permissions

| Pattern | Why it's needed |
|---|---|
| `https://api.lumenfall.ai/*` | API requests for model listing, image generation, editing, cost estimation, and balance checks. |
| `https://*/*` | Fetch images from any website for editing (context menu and drag & drop) and convert them to data URLs for display. Required because MV3's Content Security Policy blocks external image URLs in extension pages. |
| `http://localhost/*` | Local development only — allows connecting to a local API server. |

## Privacy

- Your API key is stored in `chrome.storage.local` (device-only, never synced to your Google account).
- Generated images are stored locally in your browser's extension storage.
- The extension communicates only with `api.lumenfall.ai` (or your configured base URL). No analytics, tracking, or third-party services.
- Brainstorm mode reads text from the active tab and sends it to the Lumenfall API for prompt generation. No page content is stored or transmitted elsewhere.
- See the [Lumenfall Privacy Policy](https://lumenfall.ai/privacy) for details on how the API handles your data.

## Testing (manual)

1. Load the extension as described above.
2. Open the side panel and verify Settings is visible until you set an API key.
3. Paste a valid API key and hit **Save settings** — confirm models load.
4. In **Generate**, enter a prompt and run a generation.
5. Try different output formats (PNG, JPG, WebP) and verify download filenames match.
6. Drag images into the input area and run an edit.
7. Use Copy, Download, and Drag on results.
8. In **Brainstorm**, navigate to an article and generate illustrations.
9. Right-click an image on any page and choose **Edit with Lumenfall**.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Copyright 2026 Lumenfall. All rights reserved.

See [LICENSE](LICENSE) for details.
