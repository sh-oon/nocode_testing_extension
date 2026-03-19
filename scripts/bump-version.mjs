#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const EXTENSION_PKG_PATH = resolve(ROOT, "apps/extension/package.json");
const MANIFEST_PATH = resolve(ROOT, "apps/extension/manifest.json");

const VALID_BUMPS = ["patch", "minor", "major"];

const bumpType = process.argv[2] || "patch";

if (!VALID_BUMPS.includes(bumpType)) {
  console.error(`Invalid bump type: "${bumpType}". Must be one of: ${VALID_BUMPS.join(", ")}`);
  process.exit(1);
}

const bumpVersion = (version, type) => {
  const [major, minor, patch] = version.split(".").map(Number);

  const bumped = {
    major: [major + 1, 0, 0],
    minor: [major, minor + 1, 0],
    patch: [major, minor, patch + 1],
  };

  return bumped[type].join(".");
};

const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf-8"));

const writeJson = (filePath, data) =>
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");

const pkg = readJson(EXTENSION_PKG_PATH);
const manifest = readJson(MANIFEST_PATH);

const currentVersion = pkg.version;
const newVersion = bumpVersion(currentVersion, bumpType);

pkg.version = newVersion;
manifest.version = newVersion;

writeJson(EXTENSION_PKG_PATH, pkg);
writeJson(MANIFEST_PATH, manifest);

console.log(`${currentVersion} → ${newVersion}`);
