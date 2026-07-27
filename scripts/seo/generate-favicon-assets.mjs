#!/usr/bin/env node
/**
 * Regenerates CBAMValid favicon / PWA icon set from the BrandMark shield path.
 * Run: node scripts/seo/generate-favicon-assets.mjs
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const out = path.join(root, "public");

const lightSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="512" height="512">
  <rect width="40" height="40" rx="8" fill="#FAFAF8"/>
  <path d="M20 3 35 9.5v9.7c0 8.9-6.2 15-15 17.8C11.2 34.2 5 28.1 5 19.2V9.5L20 3Z" fill="#1B4332"/>
  <path d="m13.5 20.2 4.3 4.3 8.7-9" stroke="#FAFAF8" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>`;

const solidSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="512" height="512">
  <rect width="40" height="40" fill="#1B4332"/>
  <path d="M20 3 35 9.5v9.7c0 8.9-6.2 15-15 17.8C11.2 34.2 5 28.1 5 19.2V9.5L20 3Z" fill="#D8F3DC"/>
  <path d="m13.5 20.2 4.3 4.3 8.7-9" stroke="#1B4332" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>`;

const faviconSvg = `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M20 3 35 9.5v9.7c0 8.9-6.2 15-15 17.8C11.2 34.2 5 28.1 5 19.2V9.5L20 3Z" fill="#1B4332"/>
  <path d="m13.5 20.2 4.3 4.3 8.7-9" stroke="#FAFAF8" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

function pngToIco(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = headerSize + dirEntrySize * count;
  let offset = dirSize;
  const entries = [];
  for (const png of pngBuffers) {
    const w = png.readUInt32BE(16);
    const h = png.readUInt32BE(20);
    entries.push({ w: w >= 256 ? 0 : w, h: h >= 256 ? 0 : h, size: png.length, offset, png });
    offset += png.length;
  }
  const outBuf = Buffer.alloc(offset);
  outBuf.writeUInt16LE(0, 0);
  outBuf.writeUInt16LE(1, 2);
  outBuf.writeUInt16LE(count, 4);
  let pos = 6;
  for (const e of entries) {
    outBuf.writeUInt8(e.w, pos++);
    outBuf.writeUInt8(e.h, pos++);
    outBuf.writeUInt8(0, pos++);
    outBuf.writeUInt8(0, pos++);
    outBuf.writeUInt16LE(1, pos);
    pos += 2;
    outBuf.writeUInt16LE(32, pos);
    pos += 2;
    outBuf.writeUInt32LE(e.size, pos);
    pos += 4;
    outBuf.writeUInt32LE(e.offset, pos);
    pos += 4;
  }
  for (const e of entries) e.png.copy(outBuf, e.offset);
  return outBuf;
}

async function main() {
  const light = Buffer.from(lightSvg);
  const solid = Buffer.from(solidSvg);

  const map = [
    [16, "favicon-16.png", light],
    [32, "favicon-32.png", light],
    [48, "favicon-48.png", light],
    [64, "favicon-64.png", light],
    [180, "apple-touch-icon.png", solid],
    [192, "icon-192.png", solid],
    [512, "icon-512.png", solid],
  ];

  for (const [size, name, input] of map) {
    await sharp(input).resize(size, size).png().toFile(path.join(out, name));
  }

  fs.writeFileSync(path.join(out, "favicon.svg"), faviconSvg);
  fs.mkdirSync(path.join(out, "assets/img"), { recursive: true });
  fs.writeFileSync(path.join(out, "assets/img/favicon.svg"), faviconSvg);

  const ico = pngToIco(
    [16, 32, 48].map((s) => fs.readFileSync(path.join(out, `favicon-${s}.png`))),
  );
  fs.writeFileSync(path.join(out, "favicon.ico"), ico);
  console.log(`Generated favicon set (${ico.length} byte .ico)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
