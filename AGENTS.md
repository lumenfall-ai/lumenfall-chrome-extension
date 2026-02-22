# Lumenfall Chrome Extension

## Architecture

Manifest V3 Chrome extension (v0.2.0). No build tooling — shared modules in `src/` are loaded via `<script>` tags before page-specific JS. Sidebar is the default display mode via `chrome.sidePanel` API.

### File Structure

```
external/lumenfall-chrome/
├── manifest.json          # Extension manifest (V3)
├── background.js          # Service worker: context menus, side panel setup, storage migration
├── content.js             # On-demand content script: page text extraction, draggable image overlay (Shadow DOM)
├── popup.html / .js / .css  # Main UI (sidebar or popup). Three tabs: Generate | Brainstorm | Gallery
├── editor.html / .js / .css # Standalone image editor (opened via context menu on images)
├── src/
│   ├── api.js             # Shared: fetchJson (with timeout), normalizeImageData, normalizeModels, categorizeModels
│   ├── storage.js         # Shared: storage abstraction (local vs sync), gallery CRUD, migration
│   ├── models.js          # Hardcoded fallback model definitions (image, edit, chat). Exposed as window.LUMENFALL_MODELS
│   ├── theme.css          # OKLCH design tokens for light + dark themes (matches dashboard application.css)
│   ├── components.css     # Shared component styles (cards, buttons, fields, spinner, etc.)
│   ├── theme.js           # Detect and apply light/dark/auto theme via data-theme attribute
│   └── gallery.js         # Gallery rendering, expiry detection, regenerate action
├── assets/
│   ├── lumenfall-logo.svg # SVG logo mark
│   ├── icon-16.png        # Toolbar icon (resized from platform favicon)
│   ├── icon-48.png        # Extension management icon
│   └── icon-128.png       # Chrome Web Store icon
└── AGENTS.md              # This file
```

### Module Load Order

**popup.html**: models.js → api.js → storage.js → theme.js → gallery.js → popup.js
**editor.html**: models.js → api.js → storage.js → theme.js → editor.js
**background.js**: `importScripts("src/api.js", "src/storage.js")`

### Key Design Decisions

- **Sidebar default**: `background.js` calls `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` on install.
- **Gallery replaces inline results**: Generated images go to the Gallery tab (auto-switch after generation). No more off-screen results below the form.
- **API key in local storage**: `chrome.storage.local` (device-only, never synced to Google). Preferences in `chrome.storage.sync`.
- **On-demand content script**: No `<all_urls>` content_scripts block. `content.js` is injected via `chrome.scripting.executeScript` when needed.
- **Shadow DOM overlay**: `content.js` uses a closed Shadow DOM for the draggable image overlay, preventing CSS conflicts with host pages.
- **Theme system**: CSS custom properties in OKLCH color space matching the Lumenfall dashboard. Supports light/dark/auto.

## Key IDs and Selectors

### popup.html

| Element | ID | Type |
|---|---|---|
| API Key input | `apiKey` | `input[type=password]` |
| Base URL input | `baseUrl` | `input[type=text]` |
| Theme selector | `themeSelect` | `select` |
| Display mode | `displayMode` | `select` |
| Settings panel | `settingsPanel` | `section` |
| Settings toggle | `settingsButton` | `button` |
| Close settings | `closeSettings` | `button` |
| Save settings | `saveSettings` | `button` |
| Reload models | `reloadModels` | `button` |
| Settings status | `settingsStatus` | `div` |
| Onboarding block | `onboarding` | `div` |
| API warning | `apiWarning` | `div` |
| Sidebar banner | `sidebarBanner` | `div` |
| Context menu tip | `contextMenuTip` | `div` |
| **Generate tab** | | |
| Model selector | `modelSelect` | `select` |
| Aspect ratio | `ratioSelect` | `select` |
| Count | `generateCount` | `select` |
| Prompt | `prompt` | `textarea` |
| Image upload | `imageUpload` | `input[type=file]` |
| Dropzone | `dropzone` | `div` |
| Generate button | `generateButton` | `button` |
| Clear button | `clearButton` | `button` |
| Status text | `generateStatus` | `div` |
| **Brainstorm tab** | | |
| Brainstorm model | `brainstormModel` | `select` |
| Fast image model | `fastImageModel` | `select` |
| System prompt | `brainstormSystemPrompt` | `textarea` |
| Reset prompt | `resetBrainstormPrompt` | `button` |
| Brainstorm button | `brainstormButton` | `button` |
| Brainstorm results | `brainstormResults` | `div` |
| **Gallery tab** | | |
| Gallery grid | `galleryGrid` | `div` |
| Gallery empty | `galleryEmpty` | `div` |
| Clear gallery | `clearGallery` | `button` |

### editor.html

| Element | ID | Type |
|---|---|---|
| Image URL | `imageUrl` | `input[type=text]` |
| Source image | `sourceImage` | `img` |
| Edit model | `editModel` | `select` |
| Edit prompt | `editPrompt` | `textarea` |
| Edit button | `editButton` | `button` |
| Edit status | `editStatus` | `div` |
| Edit results | `editResults` | `div` |

### Tab Switching

Tabs use `data-tab` attributes on buttons (`.tab`) and `data-tab-panel` on sections (`.tab-panel`). Switching is done by calling `setTabs("generate" | "brainstorm" | "gallery")` or clicking a tab button.

## Storage

### chrome.storage.local (sensitive / large data)

| Key | Type | Description |
|---|---|---|
| `apiKey` | string | Lumenfall API key |
| `baseUrl` | string | API base URL (default: `https://api.lumenfall.ai/openai/v1`) |
| `storedModels` | array | Cached model list from API |
| `gallery` | array | Gallery items `{ url, prompt, model, size, timestamp }` (max 50) |

### chrome.storage.sync (preferences)

| Key | Type | Default | Description |
|---|---|---|---|
| `lastModel` | string | `""` | Last selected generation model |
| `lastRatio` | string | `"1:1"` | Last selected aspect ratio |
| `brainstormModel` | string | `""` | Last selected brainstorm model |
| `fastImageModel` | string | `""` | Last selected fast image model |
| `displayMode` | string | `"sidebar"` | Display mode preference |
| `lastPrompt` | string | `""` | Last entered prompt |
| `theme` | string | `"auto"` | Theme preference (auto/light/dark) |
| `brainstormSystemPrompt` | string | `""` | Custom brainstorm system prompt |
| `sidebarSuggestionDismissed` | boolean | `false` | Whether sidebar banner was dismissed |
| `contextMenuTipDismissed` | boolean | `false` | Whether context menu tip was dismissed |

### Migration

On install, `migrateStorage()` moves `apiKey`, `baseUrl`, `storedModels` from sync → local. Converts legacy `storedResults` (bare URL array) to gallery format.

## API Endpoints

All relative to `baseUrl` (default `https://api.lumenfall.ai/openai/v1`):
- `GET /models` — List available models
- `POST /images/generations` — Generate images `{ model, prompt, size, n }`
- `POST /images/edits` — Edit images `{ model, prompt, image_url | image_base64 }`
- `POST /chat/completions` — Brainstorm prompts `{ model, messages }`

## Permissions

| Permission | Purpose |
|---|---|
| `storage` | Local + sync storage |
| `activeTab` | Access active tab for content script injection |
| `scripting` | On-demand content script injection |
| `contextMenus` | "Edit with Lumenfall" right-click menu |
| `sidePanel` | Side panel display mode |
| `host_permissions: api.lumenfall.ai, localhost` | API requests |

## Automated Testing with Claude Code

The extension popup cannot be directly controlled via the Claude in Chrome MCP tool due to cross-extension security restrictions. Here are the methods that work, ranked by reliability:

### Method 1: `mcp__Control_Chrome__execute_javascript` (Best)

The most reliable method. Open the extension popup as a full-page tab, then use the Control Chrome MCP's `execute_javascript` tool to interact with DOM elements directly.

**Setup:**
1. Load the extension unpacked from `external/lumenfall-chrome/` via `chrome://extensions` (must be done manually by the user).
2. Get the extension ID (visible on chrome://extensions or computed from the unpacked path).
3. Navigate to `chrome-extension://<EXTENSION_ID>/popup.html` to open the popup as a full page tab. Use Peekaboo to type the URL into the address bar since MCP navigate cannot access `chrome-extension://` URLs.

**Interaction pattern:**
```javascript
// Set values directly via DOM
document.getElementById('apiKey').value = 'your-key';
document.getElementById('apiKey').dispatchEvent(new Event('input'));

// Set select values
document.getElementById('modelSelect').value = 'z-image-turbo';
document.getElementById('modelSelect').dispatchEvent(new Event('change'));

// Set prompt
document.getElementById('prompt').value = 'your prompt here';
document.getElementById('prompt').dispatchEvent(new Event('input'));

// Trigger generation
document.getElementById('generateButton').click();

// Read results
document.getElementById('generateStatus').textContent;

// Switch tabs
document.querySelector('[data-tab="gallery"]').click();

// Read gallery items
document.getElementById('galleryGrid').children.length;
```

Important: Always dispatch the appropriate event (`input` for text fields, `change` for selects) after setting `.value` so the extension's event listeners fire and persist settings to storage.

### Method 2: Peekaboo Screen Control (Fallback)

Use the Peekaboo MCP for visual/accessibility-based interaction. Works for clicking buttons and typing text, but struggles with native `<select>` dropdowns on macOS.

**What works well:**
- `mcp__peekaboo__type` with `clear: true` to type into focused text fields
- `mcp__peekaboo__click` with element queries or coordinates for buttons
- `mcp__peekaboo__see` to capture UI state and find element positions
- `mcp__peekaboo__image` with `app_target: "Google Chrome"` for screenshots

**What doesn't work well:**
- Native `<select>` dropdowns — clicking coordinates is unreliable for selecting options. Use JS via Control Chrome instead.
- `mcp__peekaboo__hotkey` — frequently fails with PeekabooBridge errors for common shortcuts like `cmd+a`, `cmd+v`, `cmd+tab`.
- Long text via `mcp__peekaboo__type` — can timeout. Use `mcp__peekaboo__paste` or shorter strings.

### What Does NOT Work

- **Claude in Chrome MCP `javascript_tool`**: Cannot execute JS on `chrome-extension://` pages of other extensions. Returns "Cannot access a chrome-extension:// URL of different extension".
- **Claude in Chrome MCP `navigate`**: Cannot navigate to `chrome-extension://` or `chrome://` URLs.
- **Claude in Chrome MCP `computer` screenshot**: Cannot capture screenshots of extension pages.
- **Peekaboo type with `{return}`**: The `{return}` syntax is not interpreted as a key press. Use the `press_return: true` parameter instead.

### Recommended Test Flow

```
1. User manually loads extension and provides extension ID
2. Open popup.html as full tab via Peekaboo address bar typing:
   - mcp__peekaboo__type(text="chrome-extension://<ID>/popup.html", clear=true, press_return=true)
3. Use Control Chrome execute_javascript for all form interactions:
   - Set API key + dispatch input event
   - Set model + dispatch change event
   - Set prompt + dispatch input event
   - Click generate button
4. Poll generateStatus via JS until generation completes
5. Switch to gallery tab: document.querySelector('[data-tab="gallery"]').click()
6. Read gallery grid to verify images
7. Use Peekaboo image capture to visually verify the rendered result
```

## Extension ID

When loaded unpacked, the extension ID is deterministic based on the absolute path to the extension directory. The ID from the dev machine is `fiaiciffmklndgadbammnpchcgjclkpk` but will differ on other machines. Always check `chrome://extensions` for the actual ID.
