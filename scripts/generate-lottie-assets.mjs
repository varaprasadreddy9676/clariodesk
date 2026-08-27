#!/usr/bin/env node
// Generates ClarioDesk's small set of hand-authored Lottie (Bodymovin JSON)
// animations — brand-teal, tiny (a few KB), MIT-licensed with the repo, no
// external CDN dependency. Re-run after tuning colors/timing below.
//
//   node scripts/generate-lottie-assets.mjs

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "apps", "web", "src", "lottie");

const BRAND = [0.0902, 0.698, 0.4157, 1]; // #17B26A (design-system.md)
const BRAND_SOFT = [0.9373, 0.9882, 0.9608, 1]; // #EFFCF5

function transform(overrides = {}) {
  return {
    p: { a: 0, k: [0, 0] },
    a: { a: 0, k: [0, 0] },
    s: { a: 0, k: [100, 100] },
    r: { a: 0, k: 0 },
    o: { a: 0, k: 100 },
    ...overrides,
  };
}

// ── 3. confetti-burst — small particles fly out from center and fade (once) ─
function confettiBurst() {
  const colors = [BRAND, BRAND_SOFT, [1, 0.83, 0.24, 1], [0.98, 0.45, 0.45, 1]];
  const particleCount = 10;
  const layers = [];

  for (let i = 0; i < particleCount; i++) {
    const angle = (Math.PI * 2 * i) / particleCount + (i % 2 === 0 ? 0.15 : -0.15);
    const distance = 70 + (i % 3) * 18;
    const endX = 100 + Math.cos(angle) * distance;
    const endY = 100 + Math.sin(angle) * distance - 20; // slight upward bias
    const color = colors[i % colors.length];
    const size = 8 + (i % 3) * 3;
    const delay = (i % 4) * 2;

    layers.push({
      ddd: 0,
      ind: i + 1,
      ty: 4,
      nm: `particle${i}`,
      sr: 1,
      ks: {
        o: {
          a: 1,
          k: [
            { t: delay, s: [100] },
            { t: delay + 26, s: [0] },
          ],
        },
        r: {
          a: 1,
          k: [
            { t: delay, s: [0] },
            { t: delay + 30, s: [(i % 2 === 0 ? 1 : -1) * 180] },
          ],
        },
        p: {
          a: 1,
          k: [
            { t: delay, s: [100, 100, 0] },
            { t: delay + 30, s: [endX, endY, 0] },
          ],
        },
        a: { a: 0, k: [0, 0, 0] },
        s: {
          a: 1,
          k: [
            { t: delay, s: [60, 60, 100] },
            { t: delay + 30, s: [100, 100, 100] },
          ],
        },
      },
      ao: 0,
      shapes: [
        {
          ty: "gr",
          it: [
            i % 2 === 0
              ? { ty: "rc", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [size, size] }, r: { a: 0, k: 2 }, nm: "rect" }
              : { ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [size, size] }, nm: "ellipse" },
            { ty: "fl", c: { a: 0, k: color }, o: { a: 0, k: 100 }, nm: "fill" },
            { ty: "tr", ...transform() },
          ],
          nm: `particleGroup${i}`,
        },
      ],
      ip: 0,
      op: 60,
      st: 0,
      bm: 0,
    });
  }

  return {
    v: "5.9.0",
    fr: 30,
    ip: 0,
    op: 60,
    w: 200,
    h: 200,
    nm: "confetti-burst",
    ddd: 0,
    assets: [],
    layers,
  };
}

// ── 4. qr-pulse — concentric rings pulse outward from a center dot (loops) ──
function qrPulse() {
  const ring = (index) => {
    const delay = index * 20;
    const period = 60;
    return {
      ddd: 0,
      ind: index + 1,
      ty: 4,
      nm: `ring${index}`,
      sr: 1,
      ks: {
        o: {
          a: 1,
          k: [
            { t: delay, s: [55] },
            { t: delay + period, s: [0] },
          ],
        },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [100, 100, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: {
          a: 1,
          k: [
            { t: delay, s: [40, 40, 100] },
            { t: delay + period, s: [140, 140, 100] },
          ],
        },
      },
      ao: 0,
      shapes: [
        {
          ty: "gr",
          it: [
            { ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [90, 90] }, nm: "ellipse" },
            { ty: "st", c: { a: 0, k: BRAND }, o: { a: 0, k: 100 }, w: { a: 0, k: 5 }, lc: 2, lj: 2, nm: "stroke" },
            { ty: "tr", ...transform() },
          ],
          nm: `ringGroup${index}`,
        },
      ],
      ip: 0,
      op: 90,
      st: 0,
      bm: 0,
    };
  };

  const centerDot = {
    ddd: 0,
    ind: 4,
    ty: 4,
    nm: "centerDot",
    sr: 1,
    ks: {
      o: { a: 0, k: 100 },
      r: { a: 0, k: 0 },
      p: { a: 0, k: [100, 100, 0] },
      a: { a: 0, k: [0, 0, 0] },
      s: { a: 0, k: [100, 100, 100] },
    },
    ao: 0,
    shapes: [
      {
        ty: "gr",
        it: [
          { ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [26, 26] }, nm: "ellipse" },
          { ty: "fl", c: { a: 0, k: BRAND }, o: { a: 0, k: 100 }, nm: "fill" },
          { ty: "tr", ...transform() },
        ],
        nm: "centerDotGroup",
      },
    ],
    ip: 0,
    op: 90,
    st: 0,
    bm: 0,
  };

  return {
    v: "5.9.0",
    fr: 30,
    ip: 0,
    op: 90,
    w: 200,
    h: 200,
    nm: "qr-pulse",
    ddd: 0,
    assets: [],
    layers: [centerDot, ring(2), ring(1), ring(0)],
  };
}

const assets = {
  "confetti-burst.json": confettiBurst(),
  "qr-pulse.json": qrPulse(),
};

for (const [name, data] of Object.entries(assets)) {
  const path = join(OUT_DIR, name);
  writeFileSync(path, JSON.stringify(data));
  console.log(`wrote ${path}`);
}
