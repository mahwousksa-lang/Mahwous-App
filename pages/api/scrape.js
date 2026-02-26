const { scrapeProduct } = require('../../lib/scraper');

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'URL مطلوب' });
  try { new URL(url); } catch { return res.status(400).json({ error: 'رابط غير صحيح' }); }
  try {
    const product = await scrapeProduct(url);
    return res.status(200).json({ success: true, product });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'فشل استخراج البيانات' });
  }
}
