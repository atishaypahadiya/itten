// Minimal PNG decoder for Chromium screenshots: 8-bit RGB or RGBA,
// non-interlaced. Uses node:zlib only. Returns { width, height, channels, data }.

import { inflateSync, deflateSync } from 'node:zlib';

export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('Not a PNG');
  let pos = 8, width = 0, height = 0, depth = 0, colorType = 0, interlace = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0); height = body.readUInt32BE(4);
      depth = body[8]; colorType = body[9]; interlace = body[12];
    } else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (depth !== 8 || interlace !== 0 || ![2, 6].includes(colorType)) {
    throw new Error(`Unsupported PNG (depth ${depth}, colour type ${colorType}, interlace ${interlace})`);
  }
  const channels = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const data = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = data.subarray(y * stride, (y + 1) * stride);
    const prev = y ? data.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? out[x - channels] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= channels ? prev[x - channels] : 0;
      let v = line[x];
      switch (filter) {
        case 0: break;
        case 1: v += a; break;
        case 2: v += b; break;
        case 3: v += (a + b) >> 1; break;
        case 4: {
          const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          break;
        }
        default: throw new Error(`Bad PNG filter ${filter}`);
      }
      out[x] = v & 255;
    }
  }
  return { width, height, channels, data };
}

export function pixel(img, x, y) {
  const i = (y * img.width + x) * img.channels;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
}

// Encode 8-bit RGBA pixels as a PNG (filter 0 on every row).
export function encodePng(width, height, rgba) {
  const crcTable = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (buf) => { let c = -1; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (type, body) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
    const tb = Buffer.concat([Buffer.from(type, 'ascii'), body]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(tb));
    return Buffer.concat([len, tb, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// Scale a decoded image up by an integer factor (nearest neighbour), as RGBA.
export function upscale(img, z) {
  const w = img.width * z, h = img.height * z, out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (Math.floor(y / z) * img.width + Math.floor(x / z)) * img.channels, o = (y * w + x) * 4;
    out[o] = img.data[i]; out[o + 1] = img.data[i + 1]; out[o + 2] = img.data[i + 2]; out[o + 3] = 255;
  }
  return { width: w, height: h, channels: 4, data: out };
}

// Draw a 1-pixel rectangle outline (or a line, when w or h is 0) on an RGBA image.
export function outline(img, x, y, w, h, [r, g, b]) {
  const put = (px, py) => {
    if (px < 0 || py < 0 || px >= img.width || py >= img.height) return;
    const o = (py * img.width + px) * 4; img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
  };
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  for (let i = 0; i <= w; i++) { put(x + i, y); if (h) put(x + i, y + h); }
  for (let i = 0; i <= h; i++) { put(x, y + i); if (w) put(x + w, y + i); }
}
