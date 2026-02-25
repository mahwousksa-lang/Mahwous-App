/**
 * Image Processor - Background Removal + Compositing + Smart Cropping
 * THE POSTER LAYOUT: Character base + transparent bottle lower-center
 */
const sharp = require('sharp');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// ─────────────────────────────────────────────────────────
// BACKGROUND REMOVAL
// ─────────────────────────────────────────────────────────

/**
 * Remove white/light background from product image → returns transparent PNG buffer
 * Strategy: remove.bg API → local pixel-threshold fallback
 */
async function removeBackground(imageBuffer) {
  // Try remove.bg API first (best quality)
  if (process.env.REMOVE_BG_API_KEY) {
    try {
      return await removeWithRemoveBgApi(imageBuffer);
    } catch (err) {
      console.warn('remove.bg API failed, using local fallback:', err.message);
    }
  }
  // Local fallback: threshold-based white background removal
  return await removeWhiteBackgroundLocal(imageBuffer);
}

async function removeWithRemoveBgApi(imageBuffer) {
  const FormData = require('form-data');
  const fetch = require('node-fetch');

  const formData = new FormData();
  formData.append('image_file', imageBuffer, { filename: 'product.jpg', contentType: 'image/jpeg' });
  formData.append('size', 'auto');

  const response = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: { 'X-Api-Key': process.env.REMOVE_BG_API_KEY, ...formData.getHeaders() },
    body: formData,
  });

  if (!response.ok) throw new Error(`remove.bg API error: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Local pixel-threshold background removal
 * Works well for e-commerce product images with white/near-white backgrounds
 */
async function removeWhiteBackgroundLocal(imageBuffer) {
  const { data, info } = await sharp(imageBuffer)
    .ensureAlpha()
    .resize({ width: 1000, withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const pixels = Buffer.from(data);

  // Two-pass: flood-fill from edges to find background, then apply alpha
  const WHITE_THRESHOLD = 235;
  const visited = new Uint8Array(width * height);
  const isBackground = new Uint8Array(width * height);

  // Mark edge pixels that are white-ish as background seeds
  const queue = [];
  for (let x = 0; x < width; x++) {
    for (const y of [0, height - 1]) {
      const idx = y * width + x;
      const pIdx = idx * channels;
      if (pixels[pIdx] > WHITE_THRESHOLD && pixels[pIdx + 1] > WHITE_THRESHOLD && pixels[pIdx + 2] > WHITE_THRESHOLD) {
        queue.push(idx);
        visited[idx] = 1;
        isBackground[idx] = 1;
      }
    }
  }
  for (let y = 0; y < height; y++) {
    for (const x of [0, width - 1]) {
      const idx = y * width + x;
      if (!visited[idx]) {
        const pIdx = idx * channels;
        if (pixels[pIdx] > WHITE_THRESHOLD && pixels[pIdx + 1] > WHITE_THRESHOLD && pixels[pIdx + 2] > WHITE_THRESHOLD) {
          queue.push(idx);
          visited[idx] = 1;
          isBackground[idx] = 1;
        }
      }
    }
  }

  // BFS flood-fill
  let qi = 0;
  while (qi < queue.length) {
    const idx = queue[qi++];
    const x = idx % width;
    const y = Math.floor(idx / width);
    const neighbors = [
      y > 0 ? idx - width : -1,
      y < height - 1 ? idx + width : -1,
      x > 0 ? idx - 1 : -1,
      x < width - 1 ? idx + 1 : -1,
    ];
    for (const ni of neighbors) {
      if (ni < 0 || visited[ni]) continue;
      const pIdx = ni * channels;
      if (pixels[pIdx] > WHITE_THRESHOLD && pixels[pIdx + 1] > WHITE_THRESHOLD && pixels[pIdx + 2] > WHITE_THRESHOLD) {
        visited[ni] = 1;
        isBackground[ni] = 1;
        queue.push(ni);
      }
    }
  }

  // Apply alpha: background → transparent, with feathering for smooth edges
  for (let i = 0; i < width * height; i++) {
    if (isBackground[i]) {
      pixels[i * channels + 3] = 0;
    }
  }

  return sharp(pixels, { raw: { width, height, channels } }).png().toBuffer();
}

// ─────────────────────────────────────────────────────────
// COMPOSITING ENGINE — THE POSTER LAYOUT
// ─────────────────────────────────────────────────────────

/**
 * HERO POSTER COMPOSITE:
 * - Base: 1080x1920 character image
 * - Product: transparent PNG, resized to ~450px wide
 * - Position: lower-center with drop shadow
 */
async function compositeHeroPoster(baseImageBuffer, productPngBuffer) {
  const BASE_W = 1080;
  const BASE_H = 1920;
  const BOTTLE_MAX_W = 450;
  const BOTTOM_MARGIN = 120;

  // Get product image metadata
  const productMeta = await sharp(productPngBuffer).metadata();
  const aspectRatio = productMeta.height / productMeta.width;
  const bottleW = Math.min(BOTTLE_MAX_W, productMeta.width);
  const bottleH = Math.round(bottleW * aspectRatio);

  // Resize product image
  const resizedBottle = await sharp(productPngBuffer)
    .resize(bottleW, bottleH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // Create drop shadow layer using a blurred dark copy
  const shadowBlur = 18;
  const shadowOffsetY = 12;
  const shadowOpacity = 0.45;

  const shadowLayer = await sharp(productPngBuffer)
    .resize(bottleW, bottleH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .tint({ r: 0, g: 0, b: 0 })
    .blur(shadowBlur)
    .png()
    .toBuffer();

  // Position: centered horizontally, lower portion of the base
  const bottleLeft = Math.round((BASE_W - bottleW) / 2);
  const bottleTop = BASE_H - bottleH - BOTTOM_MARGIN;
  const shadowLeft = bottleLeft;
  const shadowTop = bottleTop + shadowOffsetY;

  // Ensure base image is exactly 1080x1920
  const baseResized = await sharp(baseImageBuffer)
    .resize(BASE_W, BASE_H, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 95 })
    .toBuffer();

  // Composite: base → shadow → bottle
  const masterBuffer = await sharp(baseResized)
    .composite([
      {
        input: shadowLayer,
        left: shadowLeft,
        top: shadowTop,
        blend: 'multiply',
      },
      {
        input: resizedBottle,
        left: bottleLeft,
        top: Math.max(0, bottleTop),
        blend: 'over',
      },
    ])
    .jpeg({ quality: 95, progressive: true })
    .toBuffer();

  return masterBuffer;
}

// ─────────────────────────────────────────────────────────
// SMART CROPPING — 5 PLATFORM SIZES
// ─────────────────────────────────────────────────────────

const PLATFORM_SIZES = [
  { name: 'story_9x16',     width: 1080, height: 1920, strategy: 'centre' },
  { name: 'vertical_4x5',  width: 1080, height: 1350, strategy: 'centre' },
  { name: 'square_1x1',    width: 1080, height: 1080, strategy: 'centre' },
  { name: 'landscape_16x9',width: 1920, height: 1080, strategy: 'attention' },
  { name: 'pinterest_2x3', width: 1000, height: 1500, strategy: 'centre' },
];

/**
 * Crop master 1080x1920 into all 5 platform sizes.
 * Uses 'attention' strategy for landscape (prevents head cutoff).
 * Output: JPG (never webp — brand requirement)
 */
async function generateAllPlatformSizes(masterBuffer, outputDir, campaignId) {
  const results = {};

  for (const size of PLATFORM_SIZES) {
    const filename = `${campaignId}_${size.name}.jpg`;
    const outputPath = path.join(outputDir, filename);

    const resizeOptions = {
      fit: 'cover',
      ...(size.strategy === 'attention'
        ? { position: sharp.strategy.attention }
        : { position: size.strategy }),
    };

    await sharp(masterBuffer)
      .resize(size.width, size.height, resizeOptions)
      .jpeg({ quality: 95, progressive: true })
      .toFile(outputPath);

    results[size.name] = { path: outputPath, filename };
    console.log(`✅ Generated: ${size.name} (${size.width}x${size.height})`);
  }

  return results;
}

/**
 * Download image from URL → Buffer
 */
async function downloadImage(url) {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'image/*',
    },
  });
  return Buffer.from(response.data);
}

module.exports = {
  removeBackground,
  compositeHeroPoster,
  generateAllPlatformSizes,
  downloadImage,
  PLATFORM_SIZES,
};
