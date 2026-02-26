/**
 * pages/api/generate.js
 *
 * ✅ ZERO DISK I/O — No fs, no path, no mkdir, no writeFile, no toFile
 * ✅ Works on Vercel, Netlify, any serverless platform
 * ✅ All image processing done in-memory with Sharp buffers
 * ✅ Images returned as base64 data URLs inside the JSON response
 */

export const config = {
  api: {
    bodyParser:    { sizeLimit: '20mb' },
    responseLimit: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { product, productImageBase64, productImageUrl } = req.body || {};
  const campaignId = `mahwous_${Date.now().toString(36)}`;

  /* ────────────────────────────────────────────────────────────
   *  Load all npm packages (CommonJS require — no ES imports)
   * ──────────────────────────────────────────────────────────── */
  let sharp, axios, GoogleAuth, GoogleGenerativeAI, nodeFetch;
  try {
    sharp              = require('sharp');
    axios              = require('axios').default;
    GoogleAuth         = require('google-auth-library').GoogleAuth;
    GoogleGenerativeAI = require('@google/generative-ai').GoogleGenerativeAI;
    nodeFetch          = require('node-fetch');
  } catch (e) {
    return res.status(500).json({ error: `فشل تحميل المكتبات: ${e.message}` });
  }

  /* ════════════════════════════════════════════════════════════
   *  STEP 1 — Get product image as Buffer
   * ════════════════════════════════════════════════════════════ */
  let rawBuffer;
  try {
    if (productImageBase64) {
      rawBuffer = Buffer.from(
        productImageBase64.replace(/^data:image\/\w+;base64,/, ''),
        'base64'
      );
    } else {
      const imgUrl = productImageUrl || product?.imageUrl;
      if (!imgUrl) {
        return res.status(400).json({
          error: 'لا توجد صورة للمنتج — ارفع صورة المنتج يدوياً في القسم الثاني',
        });
      }
      const r = await axios.get(imgUrl, {
        responseType: 'arraybuffer',
        timeout: 20000,
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'image/*' },
      });
      rawBuffer = Buffer.from(r.data);
    }
  } catch (e) {
    return res.status(500).json({ error: `الخطوة 1 — جلب صورة المنتج: ${e.message}` });
  }

  /* ════════════════════════════════════════════════════════════
   *  STEP 2 — Remove white background (in-memory BFS flood fill)
   * ════════════════════════════════════════════════════════════ */
  let transparentBuffer;
  try {
    const { data, info } = await sharp(rawBuffer)
      .ensureAlpha()
      .resize({ width: 800, withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height, channels } = info;
    const px = Buffer.from(data);
    const W  = 230; // white threshold
    const visited = new Uint8Array(width * height);
    const isBg    = new Uint8Array(width * height);
    const queue   = [];

    const seed = (i) => {
      if (visited[i]) return;
      const p = i * channels;
      if (px[p] > W && px[p + 1] > W && px[p + 2] > W) {
        visited[i] = isBg[i] = 1;
        queue.push(i);
      }
    };

    // Seed from all 4 edges
    for (let x = 0; x < width; x++) { seed(x); seed((height - 1) * width + x); }
    for (let y = 1; y < height - 1; y++) { seed(y * width); seed(y * width + width - 1); }

    // BFS
    let qi = 0;
    while (qi < queue.length) {
      const i = queue[qi++];
      const x = i % width, y = Math.floor(i / width);
      for (const ni of [
        y > 0          ? i - width : -1,
        y < height - 1 ? i + width : -1,
        x > 0          ? i - 1     : -1,
        x < width - 1  ? i + 1     : -1,
      ]) {
        if (ni < 0 || visited[ni]) continue;
        const p = ni * channels;
        if (px[p] > W && px[p + 1] > W && px[p + 2] > W) {
          visited[ni] = isBg[ni] = 1;
          queue.push(ni);
        }
      }
    }

    // Apply transparency
    for (let i = 0; i < width * height; i++) {
      if (isBg[i]) px[i * channels + 3] = 0;
    }

    transparentBuffer = await sharp(px, { raw: { width, height, channels } })
      .png()
      .toBuffer();
  } catch (e) {
    return res.status(500).json({ error: `الخطوة 2 — إزالة الخلفية: ${e.message}` });
  }

  /* ════════════════════════════════════════════════════════════
   *  STEP 3 — Generate Mahwous character via Vertex AI Imagen 3
   * ════════════════════════════════════════════════════════════ */
  let characterBuffer, outfit, sceneKey;
  try {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'instant-icon-488404-p0';
    const location  = process.env.GOOGLE_CLOUD_LOCATION   || 'us-central1';

    // Load credentials (supports both Vercel env JSON string and local file)
    let credentials;
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    } else {
      // Local dev: load from file next to this project
      try {
        credentials = require('../../service-account.json');
      } catch {
        throw new Error('لم يتم العثور على بيانات اعتماد Google. أضف GOOGLE_SERVICE_ACCOUNT_JSON في متغيرات البيئة');
      }
    }

    const auth   = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
    const client = await auth.getClient();
    const { token } = await client.getAccessToken();

    // ── Dynamic Outfit (50/50) ────────────────────────────────
    const useThobe = Math.random() > 0.5;
    outfit = useThobe ? 'thobe' : 'suit';

    const OUTFIT_SUIT  = 'Elegant black luxury suit with fine gold embroidery on lapels and cuffs. Crisp white dress shirt. Gold silk tie. Bareheaded — showing full dark styled hair.';
    const OUTFIT_THOBE = 'Pristine brilliant white Saudi Thobe. Black and gold Bisht cloak draped over shoulders with wide Zari gold embroidery. Traditional white Ghutra/Shmagh headpiece with black Iqal.';

    // ── Dynamic Scene ─────────────────────────────────────────
    const SCENES = [
      { key: 'Royal Palace',    desc: 'Inside a royal palace hall, marble floors, golden columns, dramatic chandeliers, soft warm evening light creating deep shadows.' },
      { key: 'Rolls Royce',     desc: 'Inside a sleek black Rolls-Royce Phantom interior, beige leather seats, Riyadh city lights bokeh glowing through the rear window at night.' },
      { key: 'Rose Garden',     desc: 'An ethereal luxury rose garden at golden dusk, thousands of deep red roses in bloom, soft petals floating gently in the warm light.' },
      { key: 'Royal Library',   desc: 'A breathtaking private royal library, floor-to-ceiling dark mahogany bookshelves, warm amber lamp light, rich leather-bound books.' },
      { key: 'Luxury Majlis',   desc: 'A traditional luxury Majlis with deep jewel-toned velvet cushions, ornate carved dark woodwork, warm amber lantern light.' },
      { key: 'Snow Chalet',     desc: 'A luxurious alpine ski chalet interior, crackling fireplace, panoramic snow-covered mountain view through floor-to-ceiling windows.' },
    ];
    const scene = SCENES[Math.floor(Math.random() * SCENES.length)];
    sceneKey = scene.key;

    const prompt = `
Premium 3D animated character render, Pixar/Disney quality, photorealistic skin.
FACE: Gulf Arab male, golden-brown warm skin tone. Short dark neatly groomed beard (goatee with connected mustache). Black neatly styled hair swept forward. Warm expressive BROWN EYES — fully visible, wide open, clear. Thick defined dark eyebrows. Confident friendly slight professional smile.
CRITICAL — EYES: Must be BARE brown eyes. ABSOLUTELY NO glasses. NO sunglasses. NO eyewear of any kind.
OUTFIT: ${useThobe ? OUTFIT_THOBE : OUTFIT_SUIT}
POSE: Standing confidently upright. Arms relaxed naturally at sides. NOT holding anything in hands. Full body portrait, centered composition, facing camera.
SCENE: ${scene.desc}
LIGHTING: 4K ultra-resolution. Cinematic 3-point lighting: warm golden key light, soft fill, metallic rim light. Shallow depth of field, creamy bokeh background. Rich warm tones, deep luxurious shadows.
NEGATIVE: NO glasses, NO sunglasses, NO eyewear, NO holding objects, NO bottles in hands, NO text, NO watermarks, NO logos, NO multiple people.
`.trim();

    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagen-3.0-generate-001:predict`;

    const imgRes = await nodeFetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount:       1,
          aspectRatio:       '9:16',
          negativePrompt:    'glasses, sunglasses, eyewear, spectacles, holding bottle, bottle in hand, text, watermark, logo, blurry, distorted face, cartoon face, multiple people',
          guidanceScale:     60,
          personGeneration:  'allow_adult',
          safetySetting:     'block_some',
          outputMimeType:    'image/jpeg',
        },
      }),
    });

    if (!imgRes.ok) {
      const errText = await imgRes.text();
      throw new Error(`Vertex AI (${imgRes.status}): ${errText.slice(0, 400)}`);
    }

    const imgData = await imgRes.json();
    const b64 = imgData?.predictions?.[0]?.bytesBase64Encoded;
    if (!b64) throw new Error('Vertex AI لم يُنشئ صورة — تحقق من صلاحيات المشروع وتفعيل Imagen API');

    characterBuffer = Buffer.from(b64, 'base64');
  } catch (e) {
    return res.status(500).json({ error: `الخطوة 3 — Vertex AI Imagen: ${e.message}` });
  }

  /* ════════════════════════════════════════════════════════════
   *  STEP 4 — Composite: bottle at lower-center of character image
   *  THE POSTER LAYOUT: Character stands, bottle placed in front
   * ════════════════════════════════════════════════════════════ */
  let masterBuffer;
  try {
    const W = 1080, H = 1920;
    const BOTTLE_MAX_W  = 440;
    const BOTTOM_MARGIN = 130;

    const meta  = await sharp(transparentBuffer).metadata();
    const bW    = Math.min(BOTTLE_MAX_W, meta.width);
    const bH    = Math.round(bW * (meta.height / meta.width));
    const left  = Math.round((W - bW) / 2);
    const top   = Math.max(0, H - bH - BOTTOM_MARGIN);

    // Resize bottle PNG (transparent)
    const bottleResized = await sharp(transparentBuffer)
      .resize(bW, bH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    // Create drop shadow (dark blurred version)
    const shadow = await sharp(transparentBuffer)
      .resize(bW, bH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .tint({ r: 0, g: 0, b: 0 })
      .blur(18)
      .png()
      .toBuffer();

    // Resize character base to 1080x1920
    const base = await sharp(characterBuffer)
      .resize(W, H, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 95 })
      .toBuffer();

    // Composite: base → shadow → bottle
    masterBuffer = await sharp(base)
      .composite([
        { input: shadow,        left, top: top + 14, blend: 'multiply' },
        { input: bottleResized, left, top,            blend: 'over'     },
      ])
      .jpeg({ quality: 95, progressive: true })
      .toBuffer();
  } catch (e) {
    return res.status(500).json({ error: `الخطوة 4 — التركيب: ${e.message}` });
  }

  /* ════════════════════════════════════════════════════════════
   *  STEP 5 — Crop master into 5 platform sizes (all in-memory)
   * ════════════════════════════════════════════════════════════ */
  let imageUrls;
  try {
    const SIZES = [
      { key: 'story_9x16',     w: 1080, h: 1920, pos: 'centre'    },
      { key: 'vertical_4x5',  w: 1080, h: 1350, pos: 'centre'    },
      { key: 'square_1x1',    w: 1080, h: 1080, pos: 'centre'    },
      { key: 'landscape_16x9',w: 1920, h: 1080, pos: 'attention' }, // smart crop for Twitter
      { key: 'pinterest_2x3', w: 1000, h: 1500, pos: 'centre'    },
    ];

    imageUrls = {};
    for (const s of SIZES) {
      const opts = s.pos === 'attention'
        ? { fit: 'cover', position: sharp.strategy.attention }
        : { fit: 'cover', position: s.pos };

      const buf = await sharp(masterBuffer)
        .resize(s.w, s.h, opts)
        .jpeg({ quality: 95, progressive: true })
        .toBuffer();

      // Return as base64 data URL — no file system needed
      imageUrls[s.key] = `data:image/jpeg;base64,${buf.toString('base64')}`;
    }

    // Also include master and transparent product
    imageUrls.master      = `data:image/jpeg;base64,${masterBuffer.toString('base64')}`;
    imageUrls.transparent = `data:image/png;base64,${transparentBuffer.toString('base64')}`;
  } catch (e) {
    return res.status(500).json({ error: `الخطوة 5 — قص المقاسات: ${e.message}` });
  }

  /* ════════════════════════════════════════════════════════════
   *  STEP 6 — Generate Arabic captions with Gemini
   * ════════════════════════════════════════════════════════════ */
  let content;
  try {
    if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY غير مُعيَّن');

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const n   = product?.name        || 'عطر فاخر';
    const b   = product?.brand       || 'Mahwous';
    const p   = product?.price       || '';
    const d   = product?.description || '';

    const result = await model.generateContent(`
أنت المدير الإبداعي لعلامة "مهووس" للعطور الفاخرة. شخصيتها: عربية، جريئة، فاخرة، حديثة.

المنتج: ${n}
البراند: ${b}
السعر: ${p}
الوصف: ${d}

أنشئ حملة سوشيال ميديا احترافية. أجب بـ JSON فقط بدون أي نص قبله أو بعده:

{
  "brand_story": "قصة عاطفية عربية شاعرية 2-3 جمل عن هذا العطر، أسلوب أدبي راقٍ",
  "perfume_mood": "Luxury/Formal",
  "captions": {
    "instagram": "كابشن انستغرام عربي 150-200 حرف + 10 هاشتاقات عربية وانجليزية",
    "facebook": "كابشن فيسبوك عربي 200-300 حرف، أسلوب قصصي + 5 هاشتاقات",
    "twitter": "تغريدة عربية مؤثرة أقل من 280 حرف + 3 هاشتاقات",
    "tiktok": "كابشن تيك توك عربي قصير وجذاب + 5 هاشتاقات ترند",
    "pinterest": "Pinterest description in English, SEO-optimized, 100-150 chars",
    "haraj": "إعلان حراج.كوم بالعربي: اسم المنتج + نقاط مميزات + السعر + كلمات بحث",
    "youtube": "وصف يوتيوب عربي + انجليزي 3-4 جمل مع كلمات مفتاحية"
  },
  "video_hook_prompt": "Cinematic 5-second luxury perfume hook video prompt in English",
  "video_broll_prompt": "Cinematic 5-second extreme close-up perfume bottle b-roll prompt in English"
}
`);

    const text  = result.response.text();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Gemini لم يُرجع JSON صالحاً');
    content = JSON.parse(match[0]);

  } catch (e) {
    // Graceful fallback — return hardcoded captions instead of failing
    const n = product?.name || 'عطر مهووس';
    content = {
      brand_story:   `${n} — رحلة عطرية فاخرة تأسر الحواس وتُلهم الروح. عطر يروي قصة التميز والأصالة في كل رشّة.`,
      perfume_mood:  'Luxury/Formal',
      captions: {
        instagram:  `✨ ${n}\n🌹 عطر يليق بك في كل لحظة\n#مهووس #عطور_فاخرة #عطر #فخامة #mahwous #perfume #luxury #saudiarabia #عطورك #oud`,
        facebook:   `${n} من مهووس 🌟\nعطر فاخر يُعبّر عن شخصيتك ويترك أثراً لا يُنسى.\n#مهووس #عطور #فخامة`,
        twitter:    `${n} 🌟 العطر الذي يتحدث عنك قبل أن تتكلم\n#مهووس #mahwous #عطور`,
        tiktok:     `${n} 🔥 العطر اللي يخليك تفرق عن الكل\n#مهووس #عطور #fyp #viral #فخامة`,
        pinterest:  `${n} — Luxury Arabian Perfume by Mahwous. Discover your signature scent. Shop now.`,
        haraj:      `🌹 ${n}\n• البراند: ${product?.brand || 'Mahwous'}\n• السعر: ${product?.price || 'تواصل للسعر'}\n• الحالة: جديد أصلي 100%\n• التوصيل متاح\nكلمات البحث: عطر فاخر مهووس عطور رجالي نسائي`,
        youtube:    `${n} | مهووس للعطور الفاخرة 🌟\nاكتشف عطرك المميز من مجموعة مهووس الحصرية.\nMahwous Luxury Perfumes | اطلب الآن`,
      },
      video_hook_prompt:  `Cinematic 5-second luxury perfume advertisement, first-person POV slowly approaching ${n} bottle on marble pedestal, golden particles floating, warm light.`,
      video_broll_prompt: `Cinematic extreme close-up of ${n} perfume bottle, macro lens, golden hour light refracting through glass, shallow depth of field, luxury product photography.`,
      gemini_error: e.message,
    };
  }

  /* ════════════════════════════════════════════════════════════
   *  SUCCESS — Return everything as JSON
   * ════════════════════════════════════════════════════════════ */
  return res.status(200).json({
    success:    true,
    campaignId,
    imageUrls,   // base64 data URLs — work without file system
    content,
    meta: { outfit, sceneKey },
  });
}
