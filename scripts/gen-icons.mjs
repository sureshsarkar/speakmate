// Generates the PWA icons (pure Node, no dependencies):  node scripts/gen-icons.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../client/public/icons');
fs.mkdirSync(out, { recursive: true });

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const inRoundRect = (x, y, x0, y0, w, h, r) => {
  const cx = Math.min(Math.max(x, x0 + r), x0 + w - r);
  const cy = Math.min(Math.max(y, y0 + r), y0 + h - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};

function render(size, { maskable = false, rounded = true } = {}) {
  const buf = Buffer.alloc(size * size * 4);
  const S = 3; // supersampling
  const scale = maskable ? 0.78 : 1; // keep artwork inside the maskable safe zone
  const heights = [0.2, 0.36, 0.54, 0.36, 0.2];
  const bw = size * 0.078 * scale;
  const gap = size * 0.052 * scale;
  const total = heights.length * bw + (heights.length - 1) * gap;
  const startX = (size - total) / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const px = x + (sx + 0.5) / S;
          const py = y + (sy + 0.5) / S;
          const inBg = maskable || !rounded ? true : inRoundRect(px, py, 0, 0, size, size, size * 0.22);
          if (!inBg) continue;
          const t = (px + py) / (2 * size);
          let col = [0x8f + (0x5b - 0x8f) * t, 0xe7 + (0xc2 - 0xe7) * t, 0x68 + (0x36 - 0x68) * t];
          for (let i = 0; i < heights.length; i++) {
            const h = size * heights[i] * scale * 1.15;
            if (inRoundRect(px, py, startX + i * (bw + gap), (size - h) / 2, bw, h, bw / 2)) col = [0x1b, 0x5e, 0x20];
          }
          r += col[0]; g += col[1]; b += col[2]; a += 255;
        }
      }
      const n = S * S;
      const i = (y * size + x) * 4;
      const cov = a / (255 * n);
      buf[i] = cov ? r / (cov * n) : 0;
      buf[i + 1] = cov ? g / (cov * n) : 0;
      buf[i + 2] = cov ? b / (cov * n) : 0;
      buf[i + 3] = Math.round(cov * 255);
    }
  }
  return png(size, buf);
}

fs.writeFileSync(path.join(out, 'icon-192.png'), render(192));
fs.writeFileSync(path.join(out, 'icon-512.png'), render(512));
fs.writeFileSync(path.join(out, 'maskable-512.png'), render(512, { maskable: true }));
fs.writeFileSync(path.join(out, 'apple-touch-icon.png'), render(180, { rounded: false }));
console.log('Icons written to', out);
