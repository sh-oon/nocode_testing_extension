#!/usr/bin/env node
/**
 * Generate extension icons
 * Creates simple cake emoji icons in various sizes
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '../public/icons');

// Ensure directory exists
mkdirSync(iconsDir, { recursive: true });

// SVG icon template (cake slice icon)
function createSvgIcon(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FF6B9D;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#C44569;stop-opacity:1" />
    </linearGradient>
  </defs>
  <!-- Background circle -->
  <circle cx="50" cy="50" r="48" fill="url(#grad)" />
  <!-- Cake base -->
  <rect x="20" y="45" width="60" height="35" rx="5" fill="#FFF5E6" />
  <!-- Cake middle layer -->
  <rect x="20" y="45" width="60" height="12" fill="#FFE4C4" />
  <!-- Frosting -->
  <path d="M20 45 Q30 35 40 45 Q50 35 60 45 Q70 35 80 45" stroke="#FFFFFF" stroke-width="8" fill="none" stroke-linecap="round"/>
  <!-- Cherry -->
  <circle cx="50" cy="28" r="8" fill="#FF4757" />
  <ellipse cx="48" cy="26" rx="2" ry="1.5" fill="#FFFFFF" opacity="0.6"/>
  <!-- Stem -->
  <path d="M50 20 Q55 15 52 12" stroke="#4A7023" stroke-width="2" fill="none" stroke-linecap="round"/>
  <!-- Recording dot (when active) -->
  <circle cx="75" cy="25" r="8" fill="#FF0000" opacity="0.9"/>
</svg>`;
}

// Generate icons for each size
const sizes = [16, 32, 48, 128];

for (const size of sizes) {
  const svg = createSvgIcon(size);
  const filename = `icon-${size}.svg`;
  writeFileSync(join(iconsDir, filename), svg);
  console.log(`Created ${filename}`);
}

console.log('\\nIcons generated! Converting to PNG...');

// Note: For production, you would use a library like sharp or canvas to convert SVG to PNG
// For now, we'll update the manifest to use SVG icons (Chrome supports SVG)
console.log('\\nNote: Update manifest.json to use .svg extension if PNG conversion fails.');
