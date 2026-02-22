# Changelog

All notable changes to the Lumenfall Chrome Extension will be documented in this file.

## [0.2.0] - 2025-02-12

### Added
- Rich model selector with thumbnails, descriptions, pricing, and search.
- Dual-category badges for models that support both generation and editing.
- Output format selector (PNG, JPG, WebP) in the action bar.
- Reset button to clear the generate form.
- Edit model warning when input images are attached but the selected model doesn't support editing.
- Real-time cost estimation before generation.
- Gallery with copy, download, delete, and drag-to-page actions.
- Drag & drop images into the generate form from the filesystem or webpages.
- Context menu integration: right-click any image and choose "Edit with Lumenfall".
- Brainstorm mode: extract page content and generate illustration prompts automatically.
- Balance display in the header with low-balance warning.
- Light, dark, and auto theme support (OKLCH color system matching the Lumenfall dashboard).
- Keyboard shortcut: Ctrl+Shift+L / Cmd+Shift+L to open the extension.
- Reduced motion support for users who prefer minimal animations.

### Fixed
- Download filenames now use the correct extension based on the actual image format.
- Model selector hover no longer clips the selected card's outline.

## [0.1.0] - 2025-01-15

### Added
- Initial release with image generation, editing, and basic gallery.
- API key setup via settings panel.
- Side panel and popup display modes.
