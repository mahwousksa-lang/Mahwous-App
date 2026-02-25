/**
 * API Route: POST /api/removebg
 * Standalone background removal for manual uploads
 */
export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { imageBase64 } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' });

  const { removeBackground } = require('../../lib/imageProcessor');
  const { v4: uuidv4 } = require('uuid');
  const path = require('path');
  const fs = require('fs');

  try {
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');
    const resultBuffer = await removeBackground(imageBuffer);
    
    const filename = `removebg_${uuidv4().substring(0,8)}.png`;
    const outputPath = path.join(process.cwd(), 'public', 'campaigns', filename);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, resultBuffer);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    res.status(200).json({ success: true, url: `${appUrl}/campaigns/${filename}`, filename });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Background removal failed' });
  }
}
