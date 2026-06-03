/**
 * Crop favicon.png to a centered square using only Node.js built-ins.
 * Input:  public/favicon.png  (694 x 359)
 * Output: public/favicon.png  (359 x 359, centered crop)
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const inputPath  = path.join(__dirname, '..', 'public', 'favicon.png');
const outputPath = path.join(__dirname, '..', 'public', 'favicon.png');

// ── PNG parser ────────────────────────────────────────────────────────────────

function readPNG(buf) {
  // Verify PNG signature
  const sig = [137,80,78,71,13,10,26,10];
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== sig[i]) throw new Error('Not a PNG file');
  }

  let offset = 8;
  const chunks = [];

  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset); offset += 4;
    const type   = buf.slice(offset, offset + 4).toString('ascii'); offset += 4;
    const data   = buf.slice(offset, offset + length); offset += length;
    const crc    = buf.readUInt32BE(offset); offset += 4;
    chunks.push({ type, data, crc });
    if (type === 'IEND') break;
  }

  const ihdr = chunks.find(c => c.type === 'IHDR').data;
  const width      = ihdr.readUInt32BE(0);
  const height     = ihdr.readUInt32BE(4);
  const bitDepth   = ihdr[8];
  const colorType  = ihdr[9];
  const interlace  = ihdr[12];

  if (bitDepth !== 8) throw new Error('Only 8-bit PNG supported');
  if (interlace !== 0) throw new Error('Interlaced PNG not supported');

  // Channels per pixel
  const channels = colorType === 2 ? 3   // RGB
                 : colorType === 6 ? 4   // RGBA
                 : colorType === 0 ? 1   // Grayscale
                 : colorType === 4 ? 2   // Grayscale+Alpha
                 : (() => { throw new Error('Unsupported color type: ' + colorType); })();

  // Collect IDAT chunks and decompress
  const idatBufs = chunks.filter(c => c.type === 'IDAT').map(c => c.data);
  const compressed = Buffer.concat(idatBufs);
  const raw = zlib.inflateSync(compressed);

  // Reconstruct pixels (apply PNG filters)
  const bytesPerPixel = channels;
  const stride = width * bytesPerPixel;
  const pixels = Buffer.alloc(height * stride);

  let rawOffset = 0;
  for (let y = 0; y < height; y++) {
    const filterType = raw[rawOffset++];
    const rowRaw  = raw.slice(rawOffset, rawOffset + stride); rawOffset += stride;
    const rowOut  = pixels.slice(y * stride, (y + 1) * stride);
    const prevRow = y > 0 ? pixels.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride);

    for (let x = 0; x < stride; x++) {
      const a = x >= bytesPerPixel ? rowOut[x - bytesPerPixel] : 0;
      const b = prevRow[x];
      const c = x >= bytesPerPixel ? prevRow[x - bytesPerPixel] : 0;

      let val;
      switch (filterType) {
        case 0: val = rowRaw[x]; break;
        case 1: val = (rowRaw[x] + a) & 0xff; break;
        case 2: val = (rowRaw[x] + b) & 0xff; break;
        case 3: val = (rowRaw[x] + Math.floor((a + b) / 2)) & 0xff; break;
        case 4: val = (rowRaw[x] + paethPredictor(a, b, c)) & 0xff; break;
        default: throw new Error('Unknown filter type: ' + filterType);
      }
      rowOut[x] = val;
    }
  }

  return { width, height, channels, colorType, pixels };
}

function paethPredictor(a, b, c) {
  const p  = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

// ── PNG writer ────────────────────────────────────────────────────────────────

function crc32(buf) {
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c;
    }
    return t;
  })());
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function writeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf  = Buffer.alloc(4); lenBuf.writeUInt32BE(data.length);
  const crcBuf  = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function writePNG(width, height, channels, colorType, pixels) {
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width,  0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;          // bit depth
  ihdr[9] = colorType;
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Raw filtered rows (filter type 0 = None for simplicity)
  const stride = width * channels;
  const rawRows = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    rawRows[y * (stride + 1)] = 0; // filter None
    pixels.copy(rawRows, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const compressed = zlib.deflateSync(rawRows, { level: 9 });

  return Buffer.concat([
    sig,
    writeChunk('IHDR', ihdr),
    writeChunk('IDAT', compressed),
    writeChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Crop logic ────────────────────────────────────────────────────────────────

const buf = fs.readFileSync(inputPath);
const { width, height, channels, colorType, pixels } = readPNG(buf);

console.log(`Input: ${width}x${height}, channels: ${channels}, colorType: ${colorType}`);

// Crop to centered square
const size    = Math.min(width, height);          // 359
const offsetX = Math.floor((width  - size) / 2); // 167
const offsetY = Math.floor((height - size) / 2); // 0

console.log(`Cropping to ${size}x${size} (offsetX=${offsetX}, offsetY=${offsetY})`);

const newPixels = Buffer.alloc(size * size * channels);
for (let y = 0; y < size; y++) {
  const srcRow = (y + offsetY) * width * channels + offsetX * channels;
  const dstRow = y * size * channels;
  pixels.copy(newPixels, dstRow, srcRow, srcRow + size * channels);
}

const outBuf = writePNG(size, size, channels, colorType, newPixels);
fs.writeFileSync(outputPath, outBuf);
console.log(`Done! Saved ${size}x${size} favicon to ${outputPath}`);
