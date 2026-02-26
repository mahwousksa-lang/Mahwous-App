const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

export const config = { api: { bodyParser: { sizeLimit: '20mb' }, responseLimit: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { product, productImageBase64, productImageUrl } = req.body || {};
  const campaignId = `mahwous_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const outputDir = path.join(process.cwd(), 'public', 'campaigns', campaignId);

  try { fs.mkdirSync(outputDir, { recursive: true }); }
  catch (e) { return res.status(500).json({ error: `لا يمكن إنشاء مجلد الإخراج: ${e.message}` }); }

  // Load modules
  let imgProc, aiSvc;
  try {
    imgProc = require('../../lib/imageProcessor');
    aiSvc = require('../../lib/aiService');
  } catch (e) { return res.status(500).json({ error: `فشل تحميل المكتبات: ${e.message}` }); }

  // STEP 1: Get product image
  let rawProductBuffer;
  try {
    if (productImageBase64) {
      rawProductBuffer = Buffer.from(productImageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    } else if (productImageUrl || product?.imageUrl) {
      rawProductBuffer = await imgProc.downloadImage(productImageUrl || product.imageUrl);
    } else {
      return res.status(400).json({ error: 'لا توجد صورة للمنتج. يرجى رفع صورة يدوياً في القسم الثاني.' });
    }
  } catch (e) { return res.status(500).json({ error: `الخطوة 1 — جلب الصورة: ${e.message}` }); }

  // STEP 2: Remove background
  let transparentBuffer;
  try {
    console.log('[Step 2] Removing background...');
    transparentBuffer = await imgProc.removeBackground(rawProductBuffer);
    fs.writeFileSync(path.join(outputDir, `${campaignId}_transparent.png`), transparentBuffer);
  } catch (e) { return res.status(500).json({ error: `الخطوة 2 — إزالة الخلفية: ${e.message}` }); }

  // STEP 3: Generate character
  let characterBuffer, outfit, sceneKey;
  try {
    console.log('[Step 3] Generating character via Vertex AI...');
    const result = await aiSvc.generateCharacterImage(product?.name || 'Luxury Perfume', product?.description || '');
    characterBuffer = result.buffer;
    outfit = result.outfit;
    sceneKey = result.sceneKey;
  } catch (e) { return res.status(500).json({ error: `الخطوة 3 — Vertex AI: ${e.message}` }); }

  // STEP 4: Composite
  let masterBuffer;
  try {
    console.log('[Step 4] Compositing...');
    masterBuffer = await imgProc.compositeHeroPoster(characterBuffer, transparentBuffer);
    fs.writeFileSync(path.join(outputDir, `${campaignId}_master.jpg`), masterBuffer);
  } catch (e) { return res.status(500).json({ error: `الخطوة 4 — التركيب: ${e.message}` }); }

  // STEP 5: Crop to 5 sizes
  let imagePaths;
  try {
    console.log('[Step 5] Cropping 5 sizes...');
    imagePaths = await imgProc.generateAllPlatformSizes(masterBuffer, outputDir, campaignId);
  } catch (e) { return res.status(500).json({ error: `الخطوة 5 — القص: ${e.message}` }); }

  const imageUrls = {};
  for (const [key, val] of Object.entries(imagePaths)) {
    imageUrls[key] = `${appUrl}/campaigns/${campaignId}/${val.filename}`;
  }
  imageUrls.master = `${appUrl}/campaigns/${campaignId}/${campaignId}_master.jpg`;
  imageUrls.transparent = `${appUrl}/campaigns/${campaignId}/${campaignId}_transparent.png`;

  // STEP 6: Gemini captions
  let content;
  try {
    console.log('[Step 6] Generating captions with Gemini...');
    content = await aiSvc.generateCampaignContent(product || { name: 'Luxury Perfume', brand: 'Mahwous', price: '', description: '', url: '' });
  } catch (e) {
    console.warn('Gemini fallback:', e.message);
    const n = product?.name || 'عطر مهووس';
    content = {
      brand_story: `${n} — رحلة عطرية فاخرة تأسر الحواس`,
      perfume_mood: 'Luxury/Formal',
      captions: {
        instagram: `✨ ${n}\n#مهووس #عطور #فخامة #mahwous #perfume #luxury`,
        facebook: `${n} من مهووس — تجربة لا تُنسى 🌟`,
        twitter: `${n} 🌟 #مهووس #mahwous #عطور`,
        tiktok: `${n} 🔥 #مهووس #عطور #fyp`,
        pinterest: `${n} — Luxury Arabian Perfume by Mahwous`,
        haraj: `• ${n}\n• السعر: ${product?.price || ''}\n• البراند: ${product?.brand || 'Mahwous'}`,
        youtube: `${n} | مهووس للعطور الفاخرة`,
      },
      video_hook_prompt: `Cinematic luxury perfume ad for ${n}`,
      video_broll_prompt: `Close-up of ${n} bottle with golden light`,
      gemini_error: e.message,
    };
  }

  return res.status(200).json({ success: true, campaignId, imageUrls, content, meta: { outfit, sceneKey } });
}
