# Chrome Web Store Assets

Place listing assets in this directory. These are **not** included in the extension zip.

## Required

| Asset | Size | Format | Notes |
|-------|------|--------|-------|
| Screenshots (1-5) | 1280x800 or 640x400 | PNG or JPG | At least one required. Show key features: generation, editing, gallery, brainstorm. |
| Small promo tile | 440x280 | PNG | Shown in search results and category pages. |

## Optional

| Asset | Size | Format | Notes |
|-------|------|--------|-------|
| Marquee promo tile | 1400x560 | PNG | Used for featured placements. |

## Dashboard fields (not files)

These are entered in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole):

- **Privacy policy URL**: `https://lumenfall.ai/privacy`
- **Homepage URL**: `https://lumenfall.ai` (also set in `manifest.json` as `homepage_url`)
- **Support URL**: `https://docs.lumenfall.ai/integrations/chrome-extension`
- **Category**: Productivity (or Photos)
- **Language**: English

---

## Privacy tab

Copy-paste these into the Chrome Web Store Developer Dashboard Privacy tab.

### Single purpose description

```
Generate and edit images with AI in a Chrome side panel using the Lumenfall API. Users can generate images from text prompts, edit existing web images, brainstorm contextual illustrations from page content, and manage a local gallery of generated images.
```

### Permission justifications

**storage**

```
Stores the user's Lumenfall API key, UI preferences (selected model, theme), cached model list, and gallery metadata locally on-device. No data is synced or sent to any server other than the Lumenfall API.
```

**unlimitedStorage**

```
Gallery images are stored locally as data URLs, which can quickly exceed Chrome's default 10 MB storage quota. This permission ensures users can maintain a full gallery of generated and edited images without hitting storage limits. Users can delete any images in the gallery through the UI.
```

**activeTab**

```
Required to access the active tab's ID for on-demand content script injection. Used in two features: (1) Brainstorm mode extracts visible text from the current page to generate contextual image prompts, and (2) dragging an image from the gallery onto a page injects a helper script that reconstructs the image as a proper File object for the page's dropzone. Both only activate on explicit user action (clicking Brainstorm or dragging a gallery image). No scripts run in the background or on page load.
```

**scripting**

```
Injects content scripts on demand for two features: (1) extracting page text for Brainstorm mode, and (2) a drag-drop helper that reconstructs gallery images as proper File objects when users drag them onto file-upload dropzones on other pages. Scripts are only injected when the user initiates these actions — no scripts run in the background or on page load.
```

**contextMenus**

```
Adds an "Edit with Lumenfall" item to the right-click context menu on images. This allows users to send any image on the web directly to the side panel for editing with AI models.
```

**sidePanel**

```
The entire extension UI is rendered as a Chrome side panel. This permission is required to register and display the side panel.
```

**Host permission (`https://api.lumenfall.ai/*`)**

```
The extension sends all API requests to api.lumenfall.ai — image generation, image editing, model listing, and brainstorm chat completions. This is the only host the extension contacts. Generated images are returned inline as base64 data, not fetched from a separate host. The broad optional host permission (https://*/*) is not requested at install — Chrome prompts users individually when they first try to fetch an image from a third-party site for editing.
```

### Remote code

> **No, I am not using remote code.**

```
All JavaScript is bundled in the extension package. No external scripts, modules, or eval() calls are used. The extension makes fetch() calls to the Lumenfall API which return JSON and image data only, never executable code.
```

### Data usage

Check the following data type checkboxes:

- [x] **Authentication information** — The extension collects the user's Lumenfall API key, stores it locally in `chrome.storage.local`, and transmits it as a Bearer token to `api.lumenfall.ai` with every API request.
- [x] **Website content** — The Brainstorm feature extracts page text (title and body, up to 6,000 characters) from the active tab and sends it to the Lumenfall API to generate contextual image prompts. The "Edit with Lumenfall" context menu captures image URLs from web pages, which are fetched and sent to the API for editing.

All other checkboxes should remain **unchecked** — the extension does not collect personally identifiable information, health data, financial/payment information, personal communications, location, web history, or user activity.

Certify all three disclosures:

- [x] I do not sell or transfer user data to third parties, outside of the approved use cases
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

### Privacy policy URL

```
https://lumenfall.ai/privacy
```
