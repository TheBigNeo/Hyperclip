// Renders the Hyperclip icon (a paperclip with Clippy-style eyes) to icons/icon{16,32,48,128}.png.
// No dependencies: shapes are rasterized with distance functions (4x4 supersampling) and PNG-encoded via zlib.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT_DIR = path.join(__dirname, "..", "icons");
const SIZES = [16, 32, 48, 128];
const SS = 4; // supersampling: each pixel is sampled SS x SS times

// --- Shapes -----------------------------------------------------------------------------------------------------
// The icon is designed on a 0..100 grid and scaled to the requested size when rendering.

// Points on a circle arc, used to build the rounded turns of the clip.
function arc(cx, cy, radius, from, to, steps = 24) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const angle = from + ((to - from) * i) / steps;
    points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
  }
  return points;
}

// The paperclip is a polyline with rounded turns, drawn as a thick line.
const CLIP = [
  [42, 68],
  ...arc(50, 34, 8, Math.PI, 2 * Math.PI), // small top turn (left -> right, over the top)
  ...arc(46, 70, 12, 0, Math.PI), // bottom turn (right -> left, under the bottom)
  ...arc(50, 26, 16, Math.PI, 2 * Math.PI), // large top turn (left -> right, over the top)
  [66, 80],
];

const WIRE = 5; // thickness of the metal
const WIRE_OUTLINE = 9; // thickness including the dark outline

const EYES = [
  { x: 43, y: 38 },
  { x: 57, y: 38 },
];
const EYE_R = 7;
const EYE_RIM = 1.2; // width of the dark ring around the white of the eye
const PUPIL_R = 3;
const PUPIL_OFFSET = 1.5; // pupils look slightly down and right

const COLORS = {
  outline: [45, 55, 72],
  wire: [160, 174, 192],
  eyeWhite: [255, 255, 255],
  pupil: [26, 32, 44],
};

function distToSegment(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function distToClip(px, py) {
  let dist = Infinity;
  for (let i = 0; i < CLIP.length - 1; i++) dist = Math.min(dist, distToSegment(px, py, CLIP[i], CLIP[i + 1]));
  return dist;
}

// --- Rendering --------------------------------------------------------------------------------------------------

// Returns [r, g, b] (0..255) for a point in design space, or null if the point is transparent.
function shade(x, y, withEyes) {
  if (withEyes) {
    for (const eye of EYES) {
      const distToEye = Math.hypot(x - eye.x, y - eye.y);
      if (Math.hypot(x - (eye.x + PUPIL_OFFSET), y - (eye.y + PUPIL_OFFSET)) <= PUPIL_R) return COLORS.pupil;
      if (distToEye <= EYE_R - EYE_RIM) return COLORS.eyeWhite;
      if (distToEye <= EYE_R) return COLORS.outline;
    }
  }
  const dist = distToClip(x, y);
  if (dist <= WIRE / 2) return COLORS.wire;
  if (dist <= WIRE_OUTLINE / 2) return COLORS.outline;
  return null;
}

// Renders one icon as raw RGBA pixels. Each pixel is sampled SS x SS times; the average color of the covered
// samples is the pixel color, and the covered share becomes its alpha (this is what smooths the edges).
function render(size) {
  const withEyes = size >= 32; // the eyes would turn into noise at 16 px
  const pixels = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sum = { r: 0, g: 0, b: 0 };
      let covered = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const designX = ((x + (sx + 0.5) / SS) / size) * 100;
          const designY = ((y + (sy + 0.5) / SS) / size) * 100;
          const color = shade(designX, designY, withEyes);
          if (!color) continue;
          sum.r += color[0];
          sum.g += color[1];
          sum.b += color[2];
          covered++;
        }
      }
      if (covered === 0) continue; // stays fully transparent

      const i = (y * size + x) * 4;
      pixels[i] = Math.round(sum.r / covered);
      pixels[i + 1] = Math.round(sum.g / covered);
      pixels[i + 2] = Math.round(sum.b / covered);
      pixels[i + 3] = Math.round((covered / (SS * SS)) * 255);
    }
  }
  return pixels;
}

// --- PNG encoding ---------------------------------------------------------------------------------------------
// A PNG is a signature followed by chunks: IHDR (header), IDAT (zlib-compressed pixels), IEND (end).
// Every chunk carries a CRC32 over its type and data.

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) === 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    rows[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  const file = path.join(OUT_DIR, `icon${size}.png`);
  fs.writeFileSync(file, encodePng(size, render(size)));
  console.log(`wrote ${path.relative(path.join(__dirname, ".."), file)}`);
}
