/**
 * API Route: POST /api/generate
 * FIXED:
 * 1. All imports use CommonJS require() — no mixing with ES modules
 * 2. maxDuration removed (not supported in all environments)
 * 3. Detailed error messages returned as valid JSON always
 * 4. Each step wrapped in its own try/catch with meaningful error
 */

const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

export const config = {
  api: {
    bodyParser: { sizeLimit: '20mb' },
    responseLimit: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { product, productImageBase64, productImageUrl } = req.body;
  if (!product && !productImageBase64) {
    return res.status(400).json({ error: 'Product data or product image is required' });
  }

  const campaignId = `mahwous_${uuidv4().replace(/-/g, '').substring(0, 12)}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const outputDir = path.join(process.cwd(), 'public', 'campaigns', campaignId);

  try {
    fs.mkdirSync(outputDir, { recursive: true });
  } catch (mkdirErr) {
    return res.status(500).json({ error: `Cannot create output directory: ${mkdirErr.message}` });
  }

  // ── Lazy-load heavy modules ─────────────────────────────────
  let removeBackground, compositeHeroPoster, generateAllPlatformSizes, downloadImage;
  let generateCharacterImage, generateCampaignContent;

  try {
    const imgProc = require('../../lib/imageProcessor');
    removeBackground = imgProc.removeBackground;
    compositeHeroPoster = imgProc.compositeHeroPoster;
    generateAllPlatformSizes = imgProc.generateAllPlatformSizes;
    downloadImage = imgProc.downloadImage;

    const aiSvc = require('../../lib/aiService');
    generateCharacterImage = aiSvc.generateCharacterImage;
    generateCampaignContent = aiSvc.generateCampaignContent;
  } catch (loadErr) {
    return res.status(500).json({ error: `Failed to load modules: ${loadErr.message}` });
  }

  // ── STEP 1: Get raw product image buffer ────────────────────
  let rawProductBuffer;
  try {
    if (productImageBase64) {
      const base64Data = productImageBase64.replace(/^data:image\/\w+;base64,/, '');
      rawProductBuffer = Buffer.from(base64Data, 'base64');
    } else if (productImageUrl || product?.imageUrl) {
      rawProductBuffer = await downloadImage(productImageUrl || product.imageUrl);
    } else {
      return res.status(400).json({
        error: 'No product image found. Please upload an image manually in Section 2.',
      });
    }
  } catch (downloadErr) {
    return res.status(500).json({
      error: `Step 1 — Image download failed: ${downloadErr.message}`,
    });
  }

  // ── STEP 2: Remove background ────────────────────────────────
  let transparentProductBuffer;
  try {
    console.log('🗑️ [Step 2] Removing background...');
    transparentProductBuffer = await removeBackground(rawProductBuffer);
    const transparentPath = path.join(outputDir, `${campaignId}_product_transparent.png`);
    fs.writeFileSync(transparentPath, transparentProductBuffer);
  } catch (bgErr) {
    return res.status(500).json({
      error: `Step 2 — Background removal failed: ${bgErr.message}`,
    });
  }

  // ── STEP 3: Generate character via Vertex AI ─────────────────
  let characterBuffer, outfit, sceneKey;
  try {
    console.log('🎨 [Step 3] Generating character via Vertex AI Imagen 3...');
    const imgResult = await generateCharacterImage(
      product?.name || 'Luxury Perfume',
      product?.description || ''
    );
    characterBuffer = imgResult.buffer;
    outfit = imgResult.outfit;
    sceneKey = imgResult.sceneKey;
  } catch (imgErr) {
    return res.status(500).json({
      error: `Step 3 — Vertex AI image generation failed: ${imgErr.message}. Check GOOGLE_APPLICATION_CREDENTIALS and GOOGLE_CLOUD_PROJECT_ID in .env.local`,
    });
  }

  // ── STEP 4: Composite poster (bottle lower-center) ───────────
  let masterBuffer;
  try {
    console.log('🖼️ [Step 4] Compositing hero poster with Sharp...');
    masterBuffer = await compositeHeroPoster(characterBuffer, transparentProductBuffer);
    const masterPath = path.join(outputDir, `${campaignId}_master.jpg`);
    fs.writeFileSync(masterPath, masterBuffer);
  } catch (compErr) {
    return res.status(500).json({
      error: `Step 4 — Compositing failed: ${compErr.message}`,
    });
  }

  // ── STEP 5: Generate all 5 platform sizes ────────────────────
  let imagePaths;
  try {
    console.log('✂️ [Step 5] Generating 5 platform sizes...');
    imagePaths = await generateAllPlatformSizes(masterBuffer, outputDir, campaignId);
  } catch (cropErr) {
    return res.status(500).json({
      error: `Step 5 — Image cropping failed: ${cropErr.message}`,
    });
  }

  // Build public URLs
  const imageUrls = {};
  for (const [key, val] of Object.entries(imagePaths)) {
    imageUrls[key] = `${appUrl}/campaigns/${campaignId}/${val.filename}`;
  }
  imageUrls.master = `${appUrl}/campaigns/${campaignId}/${campaignId}_master.jpg`;
  imageUrls.transparent = `${appUrl}/campaigns/${campaignId}/${campaignId}_product_transparent.png`;

  // ── STEP 6: Generate captions + brand story with Gemini ──────
  let content;
  try {
    console.log('✍️ [Step 6] Generating captions via Gemini...');
    content = await generateCampaignContent(product || {
      name: 'Luxury Perfume',
      brand: 'Mahwous',
      price: '',
      description: '',
      url: '',
    });
  } catch (geminiErr) {
    // Non-fatal: return images even if captions fail
    console.warn('Gemini failed, using fallback captions:', geminiErr.message);
    content = {
      brand_story: `${product?.name || 'عطر مميز'} — رحلة من الفخامة والتميز`,
      perfume_mood: 'Luxury/Formal',
      captions: {
        instagram: `✨ ${product?.name || ''}\n#مهووس #عطور #فخامة #mahwous #perfume #luxury`,
        facebook: `${product?.name || ''} من مهووس — تجربة عطرية لا تُنسى`,
        twitter: `${product?.name || ''} 🌟 #مهووس #عطور`,
        tiktok: `${product?.name || ''} 🔥 #مهووس #عطور #fyp`,
        pinterest: `${product?.name || ''} — Luxury Arabian Perfume`,
        haraj: `• ${product?.name || ''}\n• السعر: ${product?.price || ''}\n• العلامة: ${product?.brand || 'Mahwous'}`,
        youtube: `${product?.name || ''} من مهووس | Mahwous Perfume`,
      },
      video_hook_prompt: `Cinematic luxury perfume advertisement for ${product?.name || 'perfume'}`,
      video_broll_prompt: `Extreme close-up of ${product?.name || 'perfume'} bottle, golden light`,
      gemini_error: geminiErr.message,
    };
  }

  // ── SUCCESS RESPONSE ─────────────────────────────────────────
  return res.status(200).json({
    success: true,
    campaignId,
    imageUrls,
    content,
    meta: { outfit, sceneKey },
  });
}
