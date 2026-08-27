#!/usr/bin/env node
// Generates placeholder PWA icons: a solid brand-color square with a centered
// white "C" glyph, built from a hand-rolled bitmap (no image-library
// dependency). Re-run after changing BRAND_COLOR to regenerate.
//
//   node scripts/generate-pwa-icons.mjs
//
// Swap these for real branded artwork before a public launch — this exists so
// the PWA is installable out of the box, not as final design.

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "apps", "web", "public", "icons");

const BRAND_COLOR = [0x00, 0xa8, 0x84]; // --brand teal-green
const GLYPH_COLOR = [0xff, 0xff, 0xff];

// 16x16 bitmap of a "C" glyph (1 = glyph pixel), scaled up to fill the icon.
// prettier-ignore
const GLYPH = [
  "0000011111100000",
  "0001111111111000",
  "0011110000111100",
  "0111100000011110",
  "0111000000000110",
  "1110000000000000",
  "1110000000000000",
  "1110000000000000",
  "1110000000000000",
  "1110000000000000",
  "0111000000000000",
  "0111100000011110",
  "0011110000111100",
  "0001111111111000",
  "0000011111100000",
  "0000000000000000",
].map((row) => row.split("").map(Number));

function crc32(buf) {
  let c;
  const table = crc32.table ?? (crc32.table = makeCrcTable());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (crc ^ buf[i]) & 0xff;
    crc = (crc >>> 8) ^ table[c];
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function makeCrcTable() {
  const table = new Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

/** Renders a solid-color square with the glyph centered, as a PNG buffer. */
function renderIcon(size) {
  const glyphSize = GLYPH.length;
  const scale = Math.floor((size * 0.6) / glyphSize);
  const glyphPx = glyphSize * scale;
  const offset = Math.floor((size - glyphPx) / 2);

  const rowBytes = size * 3; // RGB, no alpha — keeps the encoder simple
  const raw = Buffer.alloc((rowBytes + 1) * size); // +1 filter byte per row

  for (let y = 0; y < size; y++) {
    const rowStart = y * (rowBytes + 1);
    raw[rowStart] = 0; // filter type: none
    for (let x = 0; x < size; x++) {
      const gx = Math.floor((x - offset) / scale);
      const gy = Math.floor((y - offset) / scale);
      const inGlyph =
        gx >= 0 && gx < glyphSize && gy >= 0 && gy < glyphSize && GLYPH[gy][gx] === 1;
      const color = inGlyph ? GLYPH_COLOR : BRAND_COLOR;
      const px = rowStart + 1 + x * 3;
      raw[px] = color[0];
      raw[px + 1] = color[1];
      raw[px + 2] = color[2];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  const path = join(OUT_DIR, `icon-${size}.png`);
  writeFileSync(path, renderIcon(size));
  console.log(`wrote ${path}`);
}
const appleTouchPath = join(OUT_DIR, "apple-touch-icon.png");
writeFileSync(appleTouchPath, renderIcon(180));
console.log(`wrote ${appleTouchPath}`);
