/**
 * VizHash — Visual hash generator
 * Port of sebsauvage's VizHash GD (PHP) to TypeScript/Canvas.
 * Generates a unique, deterministic visual identity from a string (email).
 *
 * @see https://sebsauvage.net/wiki/doku.php?id=php:vizhash_gd_source
 */

// ─── Seeded PRNG (mulberry32) ──────────────────────────────────────────────

function seedFromString(str: string): number {
  // Use two hash passes for better distribution
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Drawing ───────────────────────────────────────────────────────────────

function drawVizHash(
  ctx: CanvasRenderingContext2D,
  size: number,
  rng: () => number
) {
  const randInt = (max: number) => Math.floor(rng() * max);
  const randByte = () => randInt(256);

  // Background: linear gradient
  const isVertical = rng() > 0.5;
  const grad = isVertical
    ? ctx.createLinearGradient(0, 0, 0, size)
    : ctx.createLinearGradient(0, 0, size, 0);
  grad.addColorStop(0, `rgb(${randByte()}, ${randByte()}, ${randByte()})`);
  grad.addColorStop(1, `rgb(${randByte()}, ${randByte()}, ${randByte()})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Draw 7 semi-transparent shapes (like original VizHash)
  for (let i = 0; i < 7; i++) {
    const shapeType = randInt(4);
    const x = randInt(size);
    const y = randInt(size);
    const w = Math.max(size * 0.1, randInt(size));
    const h = Math.max(size * 0.1, randInt(size));
    const r = randByte();
    const g = randByte();
    const b = randByte();
    const alpha = 0.15 + rng() * 0.55;

    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    ctx.beginPath();

    switch (shapeType) {
      case 0: // Rectangle
        ctx.fillRect(x - w / 2, y - h / 2, w, h);
        break;
      case 1: // Ellipse
        ctx.ellipse(x, y, w / 2, h / 2, rng() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 2: // Triangle / polygon
        {
          const sides = 3 + randInt(3); // 3-5 sides
          const radius = w / 2;
          const angleOffset = rng() * Math.PI * 2;
          for (let s = 0; s < sides; s++) {
            const angle = angleOffset + (s * 2 * Math.PI) / sides;
            const px = x + Math.cos(angle) * radius;
            const py = y + Math.sin(angle) * radius;
            if (s === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
        }
        break;
      case 3: // Arc / pie
        {
          const startAngle = rng() * Math.PI * 2;
          const endAngle = startAngle + Math.PI * (0.5 + rng() * 1.5);
          ctx.moveTo(x, y);
          ctx.arc(x, y, w / 2, startAngle, endAngle);
          ctx.closePath();
          ctx.fill();
        }
        break;
    }
  }
}

// ─── Cache & Public API ────────────────────────────────────────────────────

const cache = new Map<string, string>();

/**
 * Generate a VizHash image as a data URL.
 * Must be called client-side only (uses Canvas).
 *
 * @param text  - The input string (typically an email)
 * @param size  - Image size in pixels (square). Default: 128
 * @returns       Data URL (image/png)
 */
export function generateVizHash(text: string, size = 128): string {
  const key = `${text}:${size}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const seed = seedFromString(text.toLowerCase().trim());
  const rng = mulberry32(seed);
  drawVizHash(ctx, size, rng);

  const dataUrl = canvas.toDataURL("image/png");
  cache.set(key, dataUrl);
  return dataUrl;
}
