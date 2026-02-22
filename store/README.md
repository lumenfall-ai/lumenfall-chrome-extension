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
