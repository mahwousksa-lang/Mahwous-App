/**
 * API Route: POST /api/generate
 * Main Campaign Generation Pipeline:
 * 1. Optional: Download product image (or use uploaded)
 * 2. Remove background from product image
 * 3. Generate Mahwous character via Vertex AI Imagen 3
 * 4. Composite product onto character background (Poster Layout)
 * 5. Crop into 5 platform sizes
 * 6. Generate captions/story via Gemini
 * Return: all image URLs + all content
 */

import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Lazy imports to avoid issues with Next.js
  const { removeBackground, compositeHeroPoster, generateAllPlatformSizes, downloadImage } = require('../../lib/imageProcessor');
  const { generateCharacterImage, generateCampaignContent } = require('../../lib/aiService');

  const { product, productImageBase64, productImageUrl } = req.body;

  if (!product) return res.status(400).json({ error: 'Product data is required' });

  const campaignId = `mahwous_${uuidv4().replace(/-/g, '').substring(0, 12)}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // Ensure output directory exists
  const outputDir = path.join(process.cwd(), 'public', 'campaigns', campaignId);
  fs.mkdirSync(outputDir, { recursive: true });

  try {
    // ── STEP 1: Get product image buffer ──────────────────
    res.setHeader('X-Progress', 'step1');
    let rawProductBuffer;

    if (productImageBase64) {
      // User uploaded override
      const base64Data = productImageBase64.replace(/^data:image\/\w+;base64,/, '');
      rawProductBuffer = Buffer.from(base64Data, 'base64');
    } else if (productImageUrl || product.imageUrl) {
      // Download from scraped URL
      rawProductBuffer = await downloadImage(productImageUrl || product.imageUrl);
    } else {
      return res.status(400).json({ error: 'No product image available. Please upload one.' });
    }

    // ── STEP 2: Remove background ─────────────────────────
    console.log('🗑️ Removing background...');
    const transparentProductBuffer = await removeBackground(rawProductBuffer);

    // Save transparent product for debugging
    const transparentPath = path.join(outputDir, `${campaignId}_product_transparent.png`);
    fs.writeFileSync(transparentPath, transparentProductBuffer);

    // ── STEP 3: Generate character via Vertex AI ──────────
    console.log('🎨 Generating character image via Vertex AI...');
    const { buffer: characterBuffer, outfit, sceneKey } = await generateCharacterImage(
      product.name,
      product.description
    );

    // ── STEP 4: Composite poster (bottle lower-center) ────
    console.log('🖼️ Compositing hero poster...');
    const masterBuffer = await compositeHeroPoster(characterBuffer, transparentProductBuffer);
    const masterPath = path.join(outputDir, `${campaignId}_master.jpg`);
    fs.writeFileSync(masterPath, masterBuffer);

    // ── STEP 5: Generate all 5 platform sizes ─────────────
    console.log('✂️ Cropping into platform sizes...');
    const imagePaths = await generateAllPlatformSizes(masterBuffer, outputDir, campaignId);

    // Build public URLs
    const imageUrls = {};
    for (const [key, val] of Object.entries(imagePaths)) {
      imageUrls[key] = `${appUrl}/campaigns/${campaignId}/${val.filename}`;
    }
    imageUrls.master = `${appUrl}/campaigns/${campaignId}/${campaignId}_master.jpg`;
    imageUrls.transparent = `${appUrl}/campaigns/${campaignId}/${campaignId}_product_transparent.png`;

    // ── STEP 6: Generate captions + brand story ───────────
    console.log('✍️ Generating captions via Gemini...');
    const content = await generateCampaignContent(product);

    // ── RESPONSE ──────────────────────────────────────────
    res.status(200).json({
      success: true,
      campaignId,
      imageUrls,
      content,
      meta: { outfit, sceneKey },
    });

  } catch (error) {
    console.error('Generation error:', error);
    // Clean up on error
    try { fs.rmSync(outputDir, { recursive: true, force: true }); } catch {}
    res.status(500).json({ error: error.message || 'Campaign generation failed' });
  }
}
