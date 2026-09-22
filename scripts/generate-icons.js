import fs from 'fs';
import zlib from 'zlib';

function createPNG(width, height, isMaskable = false) {
  // RGBA buffer with filter byte per row
  const rowStride = width * 4 + 1;
  const rawData = Buffer.alloc(rowStride * height);

  const cx = width / 2;
  const cy = height / 2;
  const rOuter = width * 0.44;
  const rInner = width * 0.28;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowStride;
    rawData[rowOffset] = 0; // Filter byte 0 (None)

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Base background: #0a0c10 (10, 12, 16)
      let r = 10;
      let g = 12;
      let b = 16;
      let a = 255;

      // Card / squircle shape
      const cornerR = isMaskable ? 0 : width * 0.22;
      const inCard = isMaskable || (
        Math.abs(dx) <= cx - 4 && Math.abs(dy) <= cy - 4
      );

      if (!inCard) {
        a = 0;
      } else {
        // Pin & Reticle Drawing
        // Pin body: circle top at cy - width*0.08, pointed down
        const pinTopDy = dy + width * 0.08;
        const pinDist = Math.sqrt(dx * dx + pinTopDy * pinTopDy);

        if (pinDist <= width * 0.24) {
          // Inside pin top
          r = 0;
          g = 255;
          b = 102; // #00FF66
          // Core circle
          if (pinDist <= width * 0.12) {
            r = 10;
            g = 12;
            b = 16;
            // Target center dot
            if (pinDist <= width * 0.04) {
              r = 0;
              g = 255;
              b = 102;
            }
          }
        } else if (dist <= rOuter && dist >= rOuter - width * 0.015) {
          // Radar ring
          r = 0;
          g = 220;
          b = 85;
          a = 180;
        } else if (dist <= rInner && dist >= rInner - width * 0.012) {
          // Inner radar
          r = 0;
          g = 255;
          b = 102;
          a = 120;
        }
      }

      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  // Compress IDAT
  const compressed = zlib.deflateSync(rawData);

  // PNG structure
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // 8-bit depth
  ihdr.writeUInt8(6, 9); // RGBA
  ihdr.writeUInt8(0, 10); // Deflate
  ihdr.writeUInt8(0, 11); // Filter
  ihdr.writeUInt8(0, 12); // Interlace
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // IDAT chunk
  const idatChunk = makeChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crc = crc32(chunk.subarray(4, 8 + len));
  chunk.writeUInt32BE(crc >>> 0, 8 + len);
  return chunk;
}

// CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Generate icons
fs.writeFileSync('public/pwa-192x192.png', createPNG(192, 192, false));
fs.writeFileSync('public/pwa-512x512.png', createPNG(512, 512, false));
fs.writeFileSync('public/pwa-maskable-512x512.png', createPNG(512, 512, true));
fs.writeFileSync('public/apple-touch-icon.png', createPNG(180, 180, false));
fs.writeFileSync('public/favicon.ico', createPNG(64, 64, false));

console.log('PWA PNG and icon assets generated successfully.');
