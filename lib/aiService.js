/**
 * AI Service — Gemini (captions) + Vertex AI Imagen 3 (character images)
 * 
 * CHARACTER DNA: Based on official Mahwous character reference image
 * - 3D Pixar/Disney quality render
 * - Gulf Arab male, golden-brown warm skin
 * - Short dark neatly groomed beard (goatee + connected mustache)  
 * - Black neatly styled hair swept forward
 * - Warm expressive BROWN EYES — NO GLASSES EVER
 * - Confident friendly slight smile
 */

const { GoogleAuth } = require('google-auth-library');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ─────────────────────────────────────────────────────────
// CHARACTER DNA CONSTANTS (Strict Visual Protocol)
// ─────────────────────────────────────────────────────────

const MAHWOUS_CHARACTER_DNA = `
Premium 3D animated character render, Pixar/Disney quality.
Gulf Arab male, golden-brown warm skin tone.
Short dark neatly groomed beard (goatee with connected mustache, chestnut-black color).
Black neatly styled hair swept forward.
Warm expressive BROWN EYES — fully visible and clear.
Thick defined dark eyebrows. Confident friendly slight professional smile.
MANDATORY: Eyes must be clear and fully visible.
STRICT NEGATIVE: NO sunglasses, NO glasses, NO eyewear of any kind whatsoever.
Character is standing confidently with arms relaxed naturally at sides — NOT holding anything.
Full body portrait, centered composition.
`;

const MAHWOUS_OUTFIT_SUIT = `
Elegant black luxury suit with fine gold embroidery on lapels and cuffs.
Crisp white dress shirt. Lustrous gold silk tie.
Gold pocket square. Black dress shoes.
Bareheaded — showing full dark styled hair.
`;

const MAHWOUS_OUTFIT_THOBE = `
Pristine brilliant white Saudi Thobe.
Black and gold Bisht (cloak) draped over shoulders with wide gold Zari embroidery trim.
Traditional white Ghutra/Shmagh headpiece with black Iqal.
`;

const CINEMATOGRAPHY_RULES = `
4K ultra-resolution, RAW render quality.
Cinematic 3-point lighting: warm golden key light, soft fill light, metallic rim light.
Rich warm tones, deep luxurious shadows, lifted blacks, golden highlights.
Shallow depth of field, creamy smooth bokeh background.
Photorealistic 3D character render with subsurface skin scattering.
NEGATIVE PROMPT: NO text, NO watermarks, NO logos, NO subtitles, NO UI elements, NO glasses, NO sunglasses.
`;

const DYNAMIC_SCENES = {
  'Luxury/Formal': 'Inside a royal palace hall, marble floors, golden columns, dramatic chandeliers, soft warm evening light creating depth.',
  'Fresh/Daytime': 'A high-end modern glass-walled penthouse office overlooking a glittering city skyline at golden hour.',
  'Oud/Oriental': 'A traditional luxury Majlis with deep jewel-toned velvet cushions, ornate carved woodwork, warm amber lantern light.',
  'Night/Bold': 'Inside a sleek black Rolls-Royce Phantom interior, beige leather, Riyadh city lights bokeh glowing through the rear window.',
  'Heritage/Friday': 'An elegant courtyard of a historic Najdi mud palace, sunset light painting long shadows, very prestigious atmosphere.',
  'Rose Garden': 'An ethereal luxury rose garden at dusk, thousands of roses in bloom, soft pink-gold light, petals floating gently.',
  'Royal Library': 'A breathtaking private royal library, floor-to-ceiling dark mahogany bookshelves, warm leather-bound books, vintage globe.',
  'Snow Cabin': 'A luxurious alpine ski chalet interior, crackling fireplace, panoramic snow-covered mountain view through floor-to-ceiling windows.',
};

function pickOutfitAndScene(perfumeDescription) {
  // 50/50 outfit randomizer
  const useThobe = Math.random() > 0.5;
  const outfit = useThobe ? 'thobe' : 'suit';
  const outfitPrompt = useThobe ? MAHWOUS_OUTFIT_THOBE : MAHWOUS_OUTFIT_SUIT;

  // Scene selection based on keywords in description
  const desc = (perfumeDescription || '').toLowerCase();
  let sceneKey = 'Luxury/Formal';
  if (desc.includes('oud') || desc.includes('عود') || desc.includes('oriental') || desc.includes('arabic')) sceneKey = 'Oud/Oriental';
  else if (desc.includes('rose') || desc.includes('floral') || desc.includes('ورد')) sceneKey = 'Rose Garden';
  else if (desc.includes('night') || desc.includes('bold') || desc.includes('intense')) sceneKey = 'Night/Bold';
  else if (desc.includes('fresh') || desc.includes('light') || desc.includes('aqua')) sceneKey = 'Fresh/Daytime';
  else if (desc.includes('heritage') || desc.includes('tradition')) sceneKey = 'Heritage/Friday';
  else {
    // Random from all scenes
    const keys = Object.keys(DYNAMIC_SCENES);
    sceneKey = keys[Math.floor(Math.random() * keys.length)];
  }

  return { outfit, outfitPrompt, sceneKey, sceneDescription: DYNAMIC_SCENES[sceneKey] };
}

function buildImagePrompt(productName, productDescription) {
  const { outfitPrompt, sceneDescription, outfit, sceneKey } = pickOutfitAndScene(productDescription);
  
  const prompt = `${MAHWOUS_CHARACTER_DNA}
  
OUTFIT: ${outfitPrompt}

SCENE: ${sceneDescription}

${CINEMATOGRAPHY_RULES}

The character is the brand ambassador 'Mahwous' for a luxury Arabian perfume brand.
This is a professional luxury advertising campaign image.
The character stands with natural elegance, slight confident posture, engaging the viewer.

CRITICAL REMINDERS:
- Character MUST NOT hold or touch any object
- Eyes MUST be fully visible brown eyes — absolutely NO glasses or sunglasses
- This is a background plate for product compositing — hands naturally at sides`;

  return { prompt, outfit, sceneKey };
}

// ─────────────────────────────────────────────────────────
// VERTEX AI — IMAGEN 3 IMAGE GENERATION
// ─────────────────────────────────────────────────────────

async function getVertexAccessToken() {
  // Support both file path and inline JSON for credentials
  let credentials;
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    credentials = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  } else if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } else {
    throw new Error('No Google credentials found. Set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_SERVICE_ACCOUNT_JSON');
  }

  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  return tokenResponse.token;
}

async function generateCharacterImage(productName, productDescription) {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'instant-icon-488404-p0';
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
  const model = 'imagen-3.0-generate-001';

  const { prompt, outfit, sceneKey } = buildImagePrompt(productName, productDescription);
  console.log(`🎨 Generating image: outfit=${outfit}, scene=${sceneKey}`);

  const accessToken = await getVertexAccessToken();
  
  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:predict`;

  const requestBody = {
    instances: [{ prompt }],
    parameters: {
      sampleCount: 1,
      aspectRatio: '9:16',
      negativePrompt: 'glasses, sunglasses, eyewear, spectacles, holding bottle, bottle in hand, text, watermark, logo, blurry, low quality, distorted face, multiple people',
      guidanceScale: 60,
      personGeneration: 'allow_adult',
      safetySetting: 'block_some',
      outputMimeType: 'image/jpeg',
    },
  };

  const fetch = require('node-fetch');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vertex AI Imagen error: ${response.status} — ${errorText}`);
  }

  const result = await response.json();
  
  if (!result.predictions || result.predictions.length === 0) {
    throw new Error('No image generated by Vertex AI');
  }

  const prediction = result.predictions[0];
  const imageBase64 = prediction.bytesBase64Encoded;
  
  if (!imageBase64) throw new Error('Empty image response from Vertex AI');

  return {
    buffer: Buffer.from(imageBase64, 'base64'),
    outfit,
    sceneKey,
  };
}

// ─────────────────────────────────────────────────────────
// GEMINI — CAPTIONS & BRAND STORY
// ─────────────────────────────────────────────────────────

async function generateCampaignContent(product) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `You are the creative director for "مهووس" (Mahwous) — a premium Arabian luxury perfume brand with a bold, confident, and modern personality. The brand ambassador is an elegant Gulf Arab man.

Product Details:
- Name: ${product.name}
- Brand: ${product.brand}
- Price: ${product.price}
- Description: ${product.description}
- Store URL: ${product.url}

Generate a complete social media campaign in Arabic (with some English brand terms). Return ONLY valid JSON with this exact structure:

{
  "brand_story": "2-3 sentence emotional Arabic brand story about this perfume. Evocative, poetic, luxury tone.",
  "perfume_mood": "One of: Luxury/Formal | Fresh/Daytime | Oud/Oriental | Night/Bold | Heritage/Friday",
  "captions": {
    "instagram": "Instagram post caption in Arabic. 150-200 chars. Include 10-15 relevant Arabic & English hashtags on new lines. Emoji-rich, luxury tone.",
    "facebook": "Facebook post in Arabic. 200-300 chars. More storytelling. 5-8 hashtags.",
    "twitter": "X (Twitter) post in Arabic. Max 280 chars. Punchy, bold, memorable. 3-5 hashtags.",
    "tiktok": "TikTok caption in Arabic. Short, energetic, trending vibe. 5-7 hashtags.",
    "pinterest": "Pinterest description in English. SEO-optimized. Descriptive. 100-150 chars.",
    "haraj": "Haraj.com listing in Arabic. Include: product name, key notes/features as bullet points, price, brand. SEO keywords at bottom.",
    "youtube": "YouTube video description in Arabic + English. 3-4 sentences. Include keywords."
  },
  "video_hook_prompt": "Cinematic 5-second luxury perfume advertisement hook prompt for video AI. First person POV approaching the bottle.",
  "video_broll_prompt": "Cinematic 5-second extreme close-up of the perfume bottle, golden light, luxury product photography prompt."
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  
  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Invalid JSON response from Gemini');
  
  return JSON.parse(jsonMatch[0]);
}

module.exports = {
  generateCharacterImage,
  generateCampaignContent,
  buildImagePrompt,
};
