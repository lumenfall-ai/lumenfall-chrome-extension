/**
 * Build script for Lumenfall Chrome Extension
 *
 * Usage:
 *   bun run scripts/build.ts          # Production build → dist/ + lumenfall-chrome.zip
 *   bun run scripts/build.ts --dev    # Dev build → dist/ with localhost in host_permissions
 */

import { $ } from "bun";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";

const ROOT = resolve(dirname(import.meta.dir));
const DIST = resolve(ROOT, "dist");
const ZIP_NAME = "lumenfall-chrome.zip";
const dev = process.argv.includes("--dev");

// Runtime files to include in the extension
const RUNTIME_FILES = [
  "manifest.json",
  "background.js",
  "content.js",
  "popup.html",
  "popup.css",
  "popup.js",
  "editor.html",
  "editor.css",
  "editor.js",
];

const RUNTIME_DIRS = ["assets", "src"];

// Clean previous build
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

// Copy runtime files
for (const file of RUNTIME_FILES) {
  cpSync(resolve(ROOT, file), resolve(DIST, file));
}

// Copy runtime directories
for (const dir of RUNTIME_DIRS) {
  cpSync(resolve(ROOT, dir), resolve(DIST, dir), { recursive: true });
}

// Dev mode: inject localhost into host_permissions
if (dev) {
  const manifestPath = resolve(DIST, "manifest.json");
  const manifest = await Bun.file(manifestPath).json();
  const hp: string[] = manifest.host_permissions ?? [];
  if (!hp.includes("http://localhost/*")) {
    hp.push("http://localhost/*");
    manifest.host_permissions = hp;
  }
  await Bun.write(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Dev build → ${DIST}  (localhost enabled)`);
} else {
  // Production: create zip for Chrome Web Store
  await $`cd ${DIST} && zip -r ${resolve(ROOT, ZIP_NAME)} . -x '*.DS_Store'`.quiet();
  console.log(`Production build → ${DIST}`);
  console.log(`Web Store zip   → ${resolve(ROOT, ZIP_NAME)}`);
}
