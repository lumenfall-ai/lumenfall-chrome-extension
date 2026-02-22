# Contributing

Thanks for your interest in improving the Lumenfall Chrome Extension! This guide covers the basics of getting set up and submitting changes.

## Prerequisites

- Google Chrome (or any Chromium-based browser)
- A [Lumenfall](https://lumenfall.ai) account and API key

No build tools, bundlers, or package managers are required. The extension is vanilla JavaScript loaded directly by the browser.

## Development setup

1. Clone the repository and navigate to the extension directory:
   ```
   git clone https://github.com/lumenfall/chrome-extension.git
   cd chrome-extension
   ```
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the repository root (the folder containing `manifest.json`).
5. Click the Lumenfall icon in the toolbar (or press Ctrl+Shift+L / Cmd+Shift+L) to open the side panel.
6. Paste your API key in Settings to start generating.

## Project structure

See [AGENTS.md](AGENTS.md) for a detailed architecture overview including file structure, module load order, storage schema, and API endpoints.

Key conventions:

- **No build step.** Shared modules live in `src/` and are loaded via `<script>` tags before page-specific JS.
- **CSS custom properties** use OKLCH color space and are defined in `src/theme.css`.
- **`chrome.storage.local`** for sensitive data (API key, cached models, gallery). **`chrome.storage.sync`** for user preferences.

## Making changes

1. Create a branch from `main`.
2. Make your changes. After editing files, reload the extension from `chrome://extensions` to pick them up.
3. Test manually using the checklist in the README.
4. Commit with a clear message describing what changed and why.
5. Open a pull request against `main`.

## Code style

- Vanilla JavaScript (ES2022+). No TypeScript, no frameworks.
- Use `const`/`let`, never `var`.
- Prefer early returns over nested conditions.
- Keep functions small and focused.
- No `console.log` or `console.warn` in production code — handle errors silently or surface them in the UI.

## Reporting issues

Open an issue on GitHub with:

- Chrome version and OS
- Steps to reproduce
- Expected vs. actual behavior
- Screenshots if applicable
