#!/usr/bin/env node
/**
 * Single source of truth: docs/WHITEPAPER.md
 * Copies to client/content/whitepaper.md and fixes image path for web.
 * Run from repo root or client: npm run sync-whitepaper (in client)
 */
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SOURCE = path.join(REPO_ROOT, "docs", "WHITEPAPER.md");
const TARGET = path.join(__dirname, "..", "content", "whitepaper.md");

async function main() {
  let content;
  try {
    content = await readFile(SOURCE, "utf-8");
  } catch (err) {
    console.warn("sync-whitepaper: source not found, using placeholder:", SOURCE, err.message);
    content = "# Whitepaper\n\nContent will be synced from `docs/WHITEPAPER.md` when available.\n";
  }

  // Fix image paths for web (docs use ../client/public/... for GitHub)
  const webContent = content
    .replace(/\]\(\.\.\/client\/public\/logo\.png\)/g, "](/logo.png)")
    .replace(/\]\(\.\.\/client\/public\/hld\.png\)/g, "](/hld.png)");

  await mkdir(path.dirname(TARGET), { recursive: true });
  await writeFile(TARGET, webContent, "utf-8");
  console.log("sync-whitepaper: copied docs/WHITEPAPER.md → client/content/whitepaper.md");
}

main();
